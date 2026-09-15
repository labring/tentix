import { XMLParser } from "fast-xml-parser";
import { Unzip, UnzipInflate } from "fflate";
import type { JSONContentZod } from "./types.ts";
import {
  GENERIC_ATTACHMENT_MAX_COUNT,
  GENERIC_ATTACHMENT_MAX_SIZE,
  GENERIC_ATTACHMENT_MAX_TOTAL_SIZE,
  getGenericAttachmentExtension,
  getGenericAttachmentMaxSize,
  isGenericAttachmentPair,
} from "./file-constants.ts";
import { getFileForDownload, getFileStat } from "./minio.ts";

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

export class FileValidationUnavailableError extends Error {
  constructor(message = "File verification is temporarily unavailable") {
    super(message);
    this.name = "FileValidationUnavailableError";
  }
}

const xmlParser = new XMLParser({
  processEntities: false,
  allowBooleanAttributes: true,
});

export function validateGenericAttachmentRequest(
  fileName: string,
  fileType: string,
  fileSize: number | undefined,
): void {
  if (!isGenericAttachmentPair(fileName, fileType)) {
    throw new FileValidationError("Unsupported attachment format");
  }
  if (
    fileSize === undefined ||
    !Number.isSafeInteger(fileSize) ||
    fileSize < 0 ||
    fileSize > getGenericAttachmentMaxSize(fileName)
  ) {
    throw new FileValidationError(
      getGenericAttachmentExtension(fileName) === "zip"
        ? "ZIP file must not exceed 50 MB"
        : "Attachment file must not exceed 25 MB",
    );
  }
}

export async function validateUploadedGenericFile(input: {
  storageFileName: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}): Promise<void> {
  validateGenericAttachmentRequest(input.fileName, input.fileType, input.fileSize);
  const stat = await getFileStat(input.storageFileName).catch(() => {
    throw new FileValidationUnavailableError();
  });
  if (stat.size !== input.fileSize || stat.type !== input.fileType) {
    throw new FileValidationError("Uploaded attachment metadata is invalid");
  }
  const extension = getGenericAttachmentExtension(input.fileName);
  if (extension === "zip") return;

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(
      await getFileForDownload(input.storageFileName).arrayBuffer(),
    );
  } catch {
    throw new FileValidationUnavailableError();
  }
  if (!extension || !matchesDeclaredFormat(extension, bytes)) {
    throw new FileValidationError("Uploaded attachment content is invalid");
  }
}

export async function validateContentAttachments(
  content: JSONContentZod,
): Promise<void> {
  const attachments: Array<Record<string, unknown>> = [];
  walkContent(content, (node) => {
    if (node.type === "attachment") attachments.push(node.attrs ?? {});
  });
  if (attachments.length > GENERIC_ATTACHMENT_MAX_COUNT) {
    throw new FileValidationError("A message cannot contain more than 5 attachments");
  }
  const totalSize = attachments.reduce(
    (total, attrs) => total + (typeof attrs.fileSize === "number" ? attrs.fileSize : 0),
    0,
  );
  if (totalSize > GENERIC_ATTACHMENT_MAX_TOTAL_SIZE) {
    throw new FileValidationError("Message attachments must not exceed 50 MB");
  }
  for (const attrs of attachments) {
    if (
      attrs.isLocalFile !== false ||
      typeof attrs.storageFileName !== "string" ||
      typeof attrs.fileName !== "string" ||
      typeof attrs.mimeType !== "string" ||
      typeof attrs.fileSize !== "number"
    ) {
      throw new FileValidationError("Attachment has not passed verification");
    }
    await validateUploadedGenericFile({
      storageFileName: attrs.storageFileName,
      fileName: attrs.fileName,
      fileType: attrs.mimeType,
      fileSize: attrs.fileSize,
    });
  }
}

function walkContent(
  node: JSONContentZod,
  visitor: (node: JSONContentZod) => void,
): void {
  visitor(node);
  node.content?.forEach((child) => walkContent(child, visitor));
}

function matchesDeclaredFormat(
  extension: string,
  bytes: Uint8Array,
): boolean {
  switch (extension) {
    case "pdf":
      return startsWithAscii(bytes, "%PDF-") && hasPdfEofMarker(bytes);
    case "json":
      return parseUtf8Json(bytes);
    case "xml":
      return parseSafeXml(bytes);
    case "txt":
    case "csv":
    case "md":
    case "yaml":
    case "yml":
    case "toml":
    case "log":
      return isUtf8Text(bytes);
    case "docx":
      return isOfficePackage(bytes, "word/document.xml");
    case "xlsx":
      return isOfficePackage(bytes, "xl/workbook.xml");
    case "pptx":
      return isOfficePackage(bytes, "ppt/presentation.xml");
    default:
      return false;
  }
}

// Office validation must inspect all package names, collect only required entries, and reject macro entries.
// The implementation must cap total decompressed bytes before accepting the package.
function isOfficePackage(bytes: Uint8Array, requiredEntry: string): boolean {
  const entries = readOfficeEntriesWithLimit(bytes, requiredEntry);
  const names = Object.keys(entries);
  if (
    !names.includes("[Content_Types].xml") ||
    !names.includes("_rels/.rels") ||
    !names.includes(requiredEntry)
  ) return false;
  const contentTypes = entries["[Content_Types].xml"];
  return contentTypes ? parseSafeXml(contentTypes) : false;
}

function isUtf8Text(bytes: Uint8Array): boolean {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return !text.includes("\u0000");
  } catch {
    return false;
  }
}

function parseUtf8Json(bytes: Uint8Array): boolean {
  try {
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return true;
  } catch {
    return false;
  }
}

function parseSafeXml(bytes: Uint8Array): boolean {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (/<\!ENTITY/i.test(text)) return false;
    xmlParser.parse(text);
    return true;
  } catch {
    return false;
  }
}

function startsWithAscii(bytes: Uint8Array, value: string): boolean {
  return new TextDecoder().decode(bytes.slice(0, value.length)) === value;
}

function hasPdfEofMarker(bytes: Uint8Array): boolean {
  const tail = new TextDecoder().decode(bytes.slice(-1024));
  return /%%EOF\s*$/.test(tail);
}

function readOfficeEntriesWithLimit(
  bytes: Uint8Array,
  requiredEntry: string,
): Record<string, Uint8Array> {
  const requiredNames = new Set([
    "[Content_Types].xml",
    "_rels/.rels",
    requiredEntry,
  ]);
  const entries: Record<string, Uint8Array> = {};
  let decompressedBytes = 0;
  let failure: FileValidationError | null = null;

  const fail = (message: string) => {
    failure ??= new FileValidationError(message);
  };

  const unzip = new Unzip((file) => {
    if (failure) return;

    if (/(^|\/)vbaProject\.bin$/i.test(file.name)) {
      fail("Office files containing macros are not supported");
      file.terminate();
      return;
    }

    if (
      file.originalSize !== undefined &&
      file.originalSize > GENERIC_ATTACHMENT_MAX_SIZE
    ) {
      fail("Office file content exceeds the allowed size");
      file.terminate();
      return;
    }

    if (!requiredNames.has(file.name)) return;

    const chunks: Uint8Array[] = [];
    let entryBytes = 0;
    file.ondata = (error, chunk, final) => {
      if (error) {
        fail("Office file cannot be read");
        return;
      }
      entryBytes += chunk.length;
      decompressedBytes += chunk.length;
      if (decompressedBytes > GENERIC_ATTACHMENT_MAX_SIZE) {
        fail("Office file content exceeds the allowed size");
        file.terminate();
        return;
      }
      chunks.push(chunk);
      if (final) {
        const value = new Uint8Array(entryBytes);
        let offset = 0;
        for (const part of chunks) {
          value.set(part, offset);
          offset += part.length;
        }
        entries[file.name] = value;
      }
    };
    file.start();
  });

  unzip.register(UnzipInflate);
  try {
    unzip.push(bytes, true);
  } catch {
    fail("Office file cannot be read");
  }
  if (failure) throw failure;
  return entries;
}
