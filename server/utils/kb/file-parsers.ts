import mammoth from "mammoth";
import Papa from "papaparse";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import TurndownService from "turndown";
import * as XLSX from "xlsx";
import { Unzip, UnzipInflate } from "fflate";
import {
  KNOWLEDGE_FILE_MAX_BYTES,
  KnowledgeFileParseError,
  type KnowledgeFileWarningKey,
} from "./file-import.ts";

export type KnowledgeFileParserInput = {
  fileName: string;
  bytes: Uint8Array;
};

export type KnowledgeFileParserResult = {
  rawText: string;
  warningKeys: KnowledgeFileWarningKey[];
};

const KNOWLEDGE_FILE_EXTENSIONS = new Set([
  "md",
  "txt",
  "html",
  "pdf",
  "docx",
  "csv",
  "xlsx",
]);
const MAX_OFFICE_EXPANDED_BYTES = KNOWLEDGE_FILE_MAX_BYTES;

export async function parseKnowledgeFile(
  input: KnowledgeFileParserInput,
): Promise<KnowledgeFileParserResult> {
  const extension = getExtension(input.fileName);
  validateFileEnvelope(input.fileName, extension, input.bytes);

  switch (extension) {
    case "md":
    case "txt":
      return parseTextFile(input.bytes, extension === "md");
    case "html":
      return parseHtmlFile(input.bytes);
    case "pdf":
      return parsePdfFile(input.bytes);
    case "docx":
      return parseDocxFile(input.bytes);
    case "csv":
      return parseCsvFile(input.bytes);
    case "xlsx":
      return parseXlsxFile(input.bytes);
    default:
      throw new KnowledgeFileParseError("knowledge_error.file_extension");
  }
}

function parseTextFile(
  bytes: Uint8Array,
  isMarkdown: boolean,
): KnowledgeFileParserResult {
  const text = decodeUtf8(bytes);
  const result = isMarkdown
    ? stripMarkdownImages(text)
    : { rawText: text, ignored: false };
  return finishText(result.rawText, result.ignored);
}

async function parseHtmlFile(
  bytes: Uint8Array,
): Promise<KnowledgeFileParserResult> {
  const converted = await htmlToMarkdown(decodeUtf8(bytes));
  return finishText(converted.rawText, converted.ignored);
}

async function parseDocxFile(
  bytes: Uint8Array,
): Promise<KnowledgeFileParserResult> {
  const packageFlags = inspectOfficeMedia(bytes, "docx");
  try {
    const converted = await mammoth.convertToHtml(
      { buffer: Buffer.from(bytes) },
      { ignoreEmptyParagraphs: false },
    );
    const markdown = await htmlToMarkdown(converted.value);
    return finishText(
      markdown.rawText,
      packageFlags.ignored || markdown.ignored,
    );
  } catch (error) {
    throw mapOfficeError(error);
  }
}

function parseCsvFile(bytes: Uint8Array): KnowledgeFileParserResult {
  const parsed = Papa.parse<string[]>(decodeUtf8(bytes), {
    skipEmptyLines: true,
  });
  if (parsed.errors.length) {
    throw new KnowledgeFileParseError("knowledge_error.file_corrupt");
  }
  return finishText(formatMarkdownTable(parsed.data), false);
}

function parseXlsxFile(bytes: Uint8Array): KnowledgeFileParserResult {
  const packageFlags = inspectOfficeMedia(bytes, "xlsx");
  try {
    const workbook = XLSX.read(Buffer.from(bytes), {
      type: "buffer",
      cellDates: true,
    });
    return finishText(
      formatWorkbookTables(workbook),
      packageFlags.ignored,
    );
  } catch (error) {
    throw mapOfficeError(error);
  }
}

async function parsePdfFile(
  bytes: Uint8Array,
): Promise<KnowledgeFileParserResult> {
  // Use PDF.js text-layer APIs only. Do not call OCR or rasterize pages.
  if (/\/Encrypt\b/.test(new TextDecoder("latin1").decode(bytes))) {
    throw new KnowledgeFileParseError("knowledge_error.file_encrypted");
  }
  const loadingTask = pdfjs.getDocument({ data: Uint8Array.from(bytes) });
  try {
    const document = await loadingTask.promise;
    const pages: string[] = [];
    let ignored = false;

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      try {
        const textContent = await page.getTextContent();
        pages.push(
          textContent.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" "),
        );
        const operatorList = await page.getOperatorList();
        ignored ||= containsPdfImageOperator(operatorList);
      } finally {
        page.cleanup();
      }
    }

    return finishText(pages.join("\n\n"), ignored);
  } catch (error) {
    throw mapPdfError(error);
  } finally {
    await loadingTask.destroy();
  }
}

async function htmlToMarkdown(
  html: string,
): Promise<{ rawText: string; ignored: boolean }> {
  let ignored = false;
  const service = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  });
  service.remove(["script", "style", "iframe"]);
  service.addRule("unsupported-content", {
    filter: (node) =>
      [
        "IMG",
        "PICTURE",
        "SVG",
        "CANVAS",
        "OBJECT",
        "EMBED",
        "VIDEO",
        "AUDIO",
        "SOURCE",
      ].includes(node.nodeName.toUpperCase()),
    replacement: () => {
      ignored = true;
      return "";
    },
  });
  const rawText = service.turndown(html);
  return { rawText, ignored };
}

function finishText(
  rawText: string,
  ignored: boolean,
): KnowledgeFileParserResult {
  const normalized = rawText.replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    throw new KnowledgeFileParseError("knowledge_error.file_no_text");
  }
  return {
    rawText: normalized,
    warningKeys: ignored ? ["knowledge_warning.unsupported_content"] : [],
  };
}

function getExtension(fileName: string): string {
  const normalizedName = fileName.trim();
  const dotIndex = normalizedName.lastIndexOf(".");
  return dotIndex >= 0 ? normalizedName.slice(dotIndex + 1).toLowerCase() : "";
}

function validateFileEnvelope(
  fileName: string,
  extension: string,
  bytes: Uint8Array,
): void {
  const normalizedName = fileName.trim();
  if (!normalizedName || normalizedName.length > 200) {
    throw new KnowledgeFileParseError("knowledge_error.file_name");
  }
  if (!KNOWLEDGE_FILE_EXTENSIONS.has(extension)) {
    throw new KnowledgeFileParseError("knowledge_error.file_extension");
  }
  if (bytes.length > KNOWLEDGE_FILE_MAX_BYTES) {
    throw new KnowledgeFileParseError("knowledge_error.file_size");
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.includes("\u0000")) {
      throw new Error("NUL byte in text file");
    }
    return text;
  } catch {
    throw new KnowledgeFileParseError("knowledge_error.file_corrupt");
  }
}

function stripMarkdownImages(
  text: string,
): { rawText: string; ignored: boolean } {
  let ignored = false;
  const patterns = [
    /!\[[^\]]*\]\([^)]*\)/g,
    /!\[[^\]]*\]\[[^\]]*\]/g,
    /<\s*(?:img|picture|svg|canvas|object|embed|video|audio|source)\b[^>]*>/gi,
  ];
  let rawText = text;
  for (const pattern of patterns) {
    rawText = rawText.replace(pattern, () => {
      ignored = true;
      return "";
    });
  }
  return { rawText, ignored };
}

function inspectOfficeMedia(
  bytes: Uint8Array,
  extension: "docx" | "xlsx",
): { ignored: boolean } {
  let ignored = false;
  let expandedBytes = 0;
  let failure: KnowledgeFileParseError | null = null;
  const mediaPrefix = extension === "docx" ? "word/" : "xl/";

  const fail = (key: KnowledgeFileParseError["translationKey"]) => {
    failure ??= new KnowledgeFileParseError(key);
  };

  const unzip = new Unzip((file) => {
    if (failure) return;
    const name = file.name.replaceAll("\\", "/");
    if (
      name.startsWith(`${mediaPrefix}media/`) ||
      name.startsWith(`${mediaPrefix}charts/`)
    ) {
      ignored = true;
    }
    if (
      file.originalSize !== undefined &&
      file.originalSize > MAX_OFFICE_EXPANDED_BYTES
    ) {
      fail("knowledge_error.file_parse_limit");
      file.terminate();
      return;
    }
    file.ondata = (error, chunk) => {
      if (error) {
        fail("knowledge_error.file_corrupt");
        return;
      }
      expandedBytes += chunk.length;
      if (expandedBytes > MAX_OFFICE_EXPANDED_BYTES) {
        fail("knowledge_error.file_parse_limit");
        file.terminate();
      }
    };
    file.start();
  });

  unzip.register(UnzipInflate);
  try {
    unzip.push(bytes, true);
  } catch {
    fail("knowledge_error.file_corrupt");
  }
  if (failure) throw failure;
  return { ignored };
}

function formatMarkdownTable(rows: string[][]): string {
  const filteredRows = rows
    .map((row) => row.map((value) => String(value ?? "")))
    .filter((row) => row.some((value) => value.trim()));
  return formatTableRows(filteredRows);
}

function formatWorkbookTables(workbook: XLSX.WorkBook): string {
  return workbook.SheetNames.map((name) => {
    const worksheet = workbook.Sheets[name];
    if (!worksheet) return "";
    const data = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: "",
      blankrows: true,
      raw: false,
    });
    fillMergedCells(data, worksheet);
    const table = formatMarkdownTable(
      data.map((row) => row.map((value) => String(value ?? ""))),
    );
    return table ? `# ${name}\n\n${table}` : "";
  })
    .filter(Boolean)
    .join("\n\n");
}

function fillMergedCells(data: unknown[][], worksheet: XLSX.WorkSheet): void {
  const merges = worksheet["!merges"] ?? [];
  const sheetRange = worksheet["!ref"]
    ? XLSX.utils.decode_range(worksheet["!ref"])
    : undefined;
  const startRow = sheetRange?.s.r ?? 0;
  const startColumn = sheetRange?.s.c ?? 0;

  for (const merge of merges) {
    const startDataRow = merge.s.r - startRow;
    const startDataColumn = merge.s.c - startColumn;
    const endDataRow = merge.e.r - startRow;
    const endDataColumn = merge.e.c - startColumn;
    const value = data[startDataRow]?.[startDataColumn] ?? "";
    if (String(value).trim() === "") continue;

    for (let rowIndex = startDataRow; rowIndex <= endDataRow; rowIndex += 1) {
      if (rowIndex < 0) continue;
      data[rowIndex] ??= [];
      for (
        let columnIndex = startDataColumn;
        columnIndex <= endDataColumn;
        columnIndex += 1
      ) {
        if (columnIndex < 0) continue;
        data[rowIndex]![columnIndex] = value;
      }
    }
  }
}

function formatTableRows(rows: string[][]): string {
  const header = rows[0];
  if (!header) return "";
  const columnCount = Math.max(
    header.length,
    ...rows.slice(1).map((row) => row.length),
  );
  const formatRow = (row: string[]) =>
    `| ${Array.from({ length: columnCount }, (_, index) =>
      escapeTableCell(row[index] ?? ""),
    ).join(" | ")} |`;
  return [
    formatRow(header),
    `| ${Array.from({ length: columnCount }, () => "---").join(" | ")} |`,
    ...rows.slice(1).map(formatRow),
  ].join("\n");
}

function escapeTableCell(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function containsPdfImageOperator(operatorList: unknown): boolean {
  if (!operatorList || typeof operatorList !== "object") return false;
  const functions = (operatorList as { fn?: unknown }).fn;
  if (!Array.isArray(functions)) return false;
  const imageOperators = new Set([
    pdfjs.OPS.paintImageMaskXObject,
    pdfjs.OPS.paintImageMaskXObjectRepeat,
    pdfjs.OPS.paintImageXObject,
    pdfjs.OPS.paintImageXObjectRepeat,
    pdfjs.OPS.paintInlineImageXObject,
    pdfjs.OPS.paintSolidColorImageMask,
  ]);
  return functions.some((value) => imageOperators.has(value as number));
}

function mapOfficeError(error: unknown): KnowledgeFileParseError {
  if (error instanceof KnowledgeFileParseError) return error;
  const message = getErrorText(error);
  if (/password|encrypt/i.test(message)) {
    return new KnowledgeFileParseError("knowledge_error.file_encrypted");
  }
  if (/exceed|limit|size/i.test(message)) {
    return new KnowledgeFileParseError("knowledge_error.file_parse_limit");
  }
  if (/zip|xml|invalid|corrupt|cannot read|unsupported/i.test(message)) {
    return new KnowledgeFileParseError("knowledge_error.file_corrupt");
  }
  return new KnowledgeFileParseError("knowledge_error.file_parse_failed");
}

function mapPdfError(error: unknown): KnowledgeFileParseError {
  if (error instanceof KnowledgeFileParseError) return error;
  const message = getErrorText(error);
  if (/password|encrypted|need_password|incorrect_password/i.test(message)) {
    return new KnowledgeFileParseError("knowledge_error.file_encrypted");
  }
  if (/exceed|limit|size/i.test(message)) {
    return new KnowledgeFileParseError("knowledge_error.file_parse_limit");
  }
  if (/invalid|corrupt|malformed|format/i.test(message)) {
    return new KnowledgeFileParseError("knowledge_error.file_corrupt");
  }
  return new KnowledgeFileParseError("knowledge_error.file_parse_failed");
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    return [error.name, error.message].join(" ");
  }
  return typeof error === "string" ? error : "";
}
