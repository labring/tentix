export const KNOWLEDGE_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const KNOWLEDGE_FILE_MAX_CANDIDATES = 100;
export const KNOWLEDGE_FILE_MAX_CONTENT_LENGTH = 20_000;

const FASTGPT_AUTO_CHUNK_SIZE = 1000;
const FASTGPT_OVERLAP_RATIO = 0.2;
const FASTGPT_AUTO_PARAGRAPH_DEEP = 3;
const KNOWLEDGE_FILE_MIN_CHUNK_SIZE = 64;
const KNOWLEDGE_FILE_MAX_CHUNK_SIZE = 4000;
const KNOWLEDGE_FILE_MAX_SPLITTER_LENGTH = 200;
const KNOWLEDGE_FILE_MAX_SPLITTERS = 10;
const KNOWLEDGE_FILE_AUTO_TITLE_MAX_LENGTH = 80;

export type KnowledgeFileSplitOptions = {
  chunkSettingMode: "auto" | "custom";
  chunkSplitMode?: "paragraph" | "size" | "char";
  paragraphChunkDeep?: number;
  chunkSize?: number;
  chunkSplitter?: string;
};

export type KnowledgeFileCandidate = {
  title: string;
  content: string;
};

export type KnowledgeFileParseErrorKey =
  | "knowledge_error.chunk_size"
  | "knowledge_error.title_depth"
  | "knowledge_error.chunk_splitter"
  | "knowledge_error.candidates_max"
  | "knowledge_error.file_missing"
  | "knowledge_error.file_name"
  | "knowledge_error.file_extension"
  | "knowledge_error.file_size"
  | "knowledge_error.file_read"
  | "knowledge_error.file_corrupt"
  | "knowledge_error.file_encrypted"
  | "knowledge_error.file_no_text"
  | "knowledge_error.file_parse_failed"
  | "knowledge_error.file_parse_limit";

export type KnowledgeFileWarningKey =
  | "knowledge_warning.unsupported_content";
export class KnowledgeFileParseError extends Error {
  constructor(public readonly translationKey: KnowledgeFileParseErrorKey) {
    super(translationKey);
  }
}

type FastGPTSplitSettings = {
  chunkSize: number;
  paragraphChunkDeep: number;
  overlapRatio: number;
  customSeparators: string[];
  candidateTitleMode: "heading" | "content";
};

type FastGPTChunk = {
  content: string;
  title: string;
};

type FastGPTSection = {
  title: string;
  lines: string[];
};

function normalizeLineEndings(rawText: string): string {
  return rawText.replace(/\r\n?/g, "\n");
}

function getHeading(line: string): { level: number; title: string } | null {
  const match = /^[ \t]{0,3}(#{1,8})[ \t]+(.+?)\s*$/.exec(line);
  if (!match) return null;
  return {
    level: match[1]!.length,
    title: match[2]!
      .replace(/\s+#+\s*$/, "")
      .replace(/\\(.)/g, "$1")
      .trim(),
  };
}

function isFence(line: string): boolean {
  return /^[ \t]{0,3}(`{3,}|~{3,})/.test(line);
}

function resolveFastGPTSettings(
  options: KnowledgeFileSplitOptions,
): FastGPTSplitSettings {
  if (options.chunkSettingMode === "auto") {
    return {
      chunkSize: FASTGPT_AUTO_CHUNK_SIZE,
      paragraphChunkDeep: FASTGPT_AUTO_PARAGRAPH_DEEP,
      overlapRatio: FASTGPT_OVERLAP_RATIO,
      customSeparators: [],
      candidateTitleMode: "heading",
    };
  }

  const chunkSize = options.chunkSize ?? FASTGPT_AUTO_CHUNK_SIZE;
  if (
    !Number.isInteger(chunkSize) ||
    chunkSize < KNOWLEDGE_FILE_MIN_CHUNK_SIZE ||
    chunkSize > KNOWLEDGE_FILE_MAX_CHUNK_SIZE
  ) {
    throw new KnowledgeFileParseError("knowledge_error.chunk_size");
  }

  const chunkSplitMode = options.chunkSplitMode ?? "paragraph";
  const paragraphChunkDeep =
    chunkSplitMode === "paragraph"
      ? options.paragraphChunkDeep ?? FASTGPT_AUTO_PARAGRAPH_DEEP
      : 0;
  if (chunkSplitMode === "paragraph" && (
    !Number.isInteger(paragraphChunkDeep) ||
    paragraphChunkDeep < 1 ||
    paragraphChunkDeep > 8
  )) {
    throw new KnowledgeFileParseError("knowledge_error.title_depth");
  }

  const customSeparators =
    chunkSplitMode === "char"
      ? parseCustomSeparators(options.chunkSplitter)
      : [];
  if (chunkSplitMode === "char" && customSeparators.length === 0) {
    throw new KnowledgeFileParseError("knowledge_error.chunk_splitter");
  }

  return {
    chunkSize,
    paragraphChunkDeep,
    overlapRatio: FASTGPT_OVERLAP_RATIO,
    customSeparators,
    candidateTitleMode: chunkSplitMode === "paragraph" ? "heading" : "content",
  };
}

function getLineUnits(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

function isMarkdownTableStart(lines: string[], index: number): boolean {
  const header = lines[index]?.trim() ?? "";
  const separator = lines[index + 1]?.trim() ?? "";
  return (
    header.startsWith("|") &&
    header.endsWith("|") &&
    /^\|?(?:[ \t]*:?-+[ \t]*\|)+[ \t]*$/.test(separator)
  );
}

function getParagraphUnits(text: string): string[] {
  const lines = getLineUnits(text);
  const units: string[] = [];
  let paragraph = "";
  let index = 0;

  const flushParagraph = () => {
    if (paragraph) units.push(paragraph);
    paragraph = "";
  };

  while (index < lines.length) {
    const line = lines[index]!;
    if (isFence(line)) {
      flushParagraph();
      let codeBlock = line;
      const fenceMarker = line.trim().slice(0, 3);
      index += 1;
      while (index < lines.length) {
        codeBlock += lines[index]!;
        const currentLine = lines[index]!.trim();
        index += 1;
        if (currentLine.startsWith(fenceMarker)) break;
      }
      units.push(codeBlock);
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      flushParagraph();
      let table = lines[index]! + lines[index + 1]!;
      index += 2;
      while (index < lines.length && lines[index]!.trim().startsWith("|")) {
        table += lines[index]!;
        index += 1;
      }
      units.push(table);
      continue;
    }

    paragraph += line;
    index += 1;
    if (!line.trim()) flushParagraph();
  }

  flushParagraph();
  return units.filter((unit) => unit.trim());
}

function getSentenceUnits(text: string): string[] {
  const chars = Array.from(text);
  const units: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current) units.push(current);
    current = "";
  };

  chars.forEach((char, index) => {
    current += char;
    const next = chars[index + 1];
    const isChineseBoundary = "。！？；".includes(char);
    const isAsciiBoundary = ".!?;".includes(char) && (!next || /\s/.test(next));
    if (isChineseBoundary || isAsciiBoundary) pushCurrent();
  });

  pushCurrent();
  return units;
}

function getWordUnits(text: string): string[] {
  const chars = Array.from(text);
  const units: string[] = [];
  let current = "";

  chars.forEach((char) => {
    current += char;
    if (/\s/.test(char)) {
      units.push(current);
      current = "";
    }
  });
  if (current) units.push(current);
  return units;
}

function getPunctuationUnits(text: string): string[] {
  const chars = Array.from(text);
  const units: string[] = [];
  let current = "";

  chars.forEach((char) => {
    current += char;
    if ("，,".includes(char)) {
      units.push(current);
      current = "";
    }
  });
  if (current) units.push(current);
  return units;
}

function getSplitUnits(text: string, level: number): string[] {
  if (level === 0) return getParagraphUnits(text);
  if (level === 1) return getLineUnits(text).filter((unit) => unit.length > 0);
  if (level === 2) return getSentenceUnits(text);
  if (level === 3) return getPunctuationUnits(text);
  if (level === 4) return getWordUnits(text);
  return Array.from(text);
}

function isHeadingOnlyUnit(unit: string): boolean {
  let hasHeading = false;
  for (const line of unit.split("\n")) {
    if (!line.trim()) continue;
    if (!getHeading(line)) return false;
    hasHeading = true;
  }
  return hasHeading;
}

function mergeHeadingUnits(units: string[], separator = ""): string[] {
  const merged: string[] = [];
  let pending = "";

  for (const unit of units) {
    if (isHeadingOnlyUnit(unit)) {
      pending += unit;
      continue;
    }
    if (pending && !unit.trim()) {
      pending += unit;
      continue;
    }
    if (pending && separator && unit) pending += separator;
    merged.push(pending + unit);
    pending = "";
  }

  if (pending) merged.push(pending);
  return merged;
}

function parseCustomSeparators(value: string | undefined): string[] {
  if (!value) return [];
  if (value.length > KNOWLEDGE_FILE_MAX_SPLITTER_LENGTH) {
    throw new KnowledgeFileParseError("knowledge_error.chunk_splitter");
  }
  const separators = value.replace(/\\n/g, "\n").split("|");
  if (
    separators.length > KNOWLEDGE_FILE_MAX_SPLITTERS ||
    separators.some((separator) => separator.length === 0)
  ) {
    throw new KnowledgeFileParseError("knowledge_error.chunk_splitter");
  }
  return separators;
}

function splitTextByCustomSeparators(
  text: string,
  maxLength: number,
  separators: string[],
  overlapRatio: number,
): string[] {
  const units = separators.reduce<string[]>(
    (current, separator) =>
      current.flatMap((unit) => unit.split(separator)),
    [text],
  ).filter((unit) => unit.trim());

  return mergeHeadingUnits(units, "\n").flatMap((unit) =>
    unit.length <= maxLength
      ? [unit]
      : splitTextRecursively(unit, maxLength, 0, overlapRatio, true),
  );
}

function limitGeneratedCandidateTitle(value: string): string {
  return Array.from(value.trim())
    .slice(0, KNOWLEDGE_FILE_AUTO_TITLE_MAX_LENGTH)
    .join("");
}

function getGeneratedCandidateTitle(content: string): string {
  const lines = content.split("\n");
  let firstText = "";
  let inFence = false;
  for (const line of lines) {
    if (!inFence) {
      const heading = getHeading(line);
      if (heading) return limitGeneratedCandidateTitle(heading.title);
    }
    if (!inFence && !firstText && line.trim() && !isFence(line)) {
      firstText = line.trim();
    }
    if (isFence(line)) inFence = !inFence;
  }
  const firstSentence = getSentenceUnits(firstText)[0]?.trim() ?? "";
  return limitGeneratedCandidateTitle(firstSentence || firstText);
}

function splitTextRecursively(
  text: string,
  maxLength: number,
  level = 0,
  overlapRatio = FASTGPT_OVERLAP_RATIO,
  preserveHeadingUnits = false,
): string[] {
  if (text.length <= maxLength) return [text];

  let units = getSplitUnits(text, level);
  if (preserveHeadingUnits) {
    units = mergeHeadingUnits(units);
  }
  if (units.length <= 1 && level < 5) {
    return splitTextRecursively(
      text,
      maxLength,
      level + 1,
      overlapRatio,
      preserveHeadingUnits,
    );
  }

  const chunks: string[] = [];
  const maxChunkLength = Math.max(maxLength, Math.floor(maxLength * 1.2));
  const minChunkLength = maxLength * 0.8;
  const allowOverlap = level >= 2;
  const maxOverlapLength = maxLength * Math.min(overlapRatio, 0.4);
  let currentUnits: string[] = [];
  let currentNewUnits: string[] = [];
  let currentLength = 0;
  let currentNewLength = 0;
  let currentHasNewText = false;

  const pushCurrent = () => {
    if (currentHasNewText) chunks.push(currentUnits.join(""));
    const lastUnits = currentHasNewText ? currentUnits : [];
    currentUnits = allowOverlap
      ? getOneTextOverlapText(lastUnits, maxOverlapLength)
      : [];
    currentNewUnits = [];
    currentLength = currentUnits.reduce((sum, unit) => sum + unit.length, 0);
    currentNewLength = 0;
    currentHasNewText = false;
  };

  for (const unit of units) {
    if (!unit) continue;

    if (unit.length > maxChunkLength) {
      pushCurrent();
      chunks.push(
        ...splitTextRecursively(
          unit,
          maxLength,
          Math.min(level + 1, 5),
          overlapRatio,
          preserveHeadingUnits,
        ),
      );
      currentUnits = [];
      currentNewUnits = [];
      currentLength = 0;
      currentNewLength = 0;
      currentHasNewText = false;
      continue;
    }

    if (
      currentLength > 0 &&
      currentLength + unit.length > maxChunkLength
    ) {
      pushCurrent();
    }

    if (currentUnits.length > 0 && currentLength + unit.length > maxChunkLength) {
      currentUnits = [];
      currentNewUnits = [];
      currentLength = 0;
      currentNewLength = 0;
      currentHasNewText = false;
    }

    currentUnits.push(unit);
    currentNewUnits.push(unit);
    currentLength += unit.length;
    currentNewLength += unit.length;
    currentHasNewText = true;

    if (currentLength >= minChunkLength && currentLength >= maxLength) {
      pushCurrent();
    }
  }

  if (currentHasNewText) {
    if (chunks.length && currentNewLength < minChunkLength * 0.5) {
      chunks[chunks.length - 1] += currentNewUnits.join("");
    } else {
      chunks.push(currentUnits.join(""));
    }
  }
  return chunks.filter((chunk) => chunk.length > 0);
}

function getOneTextOverlapText(
  units: string[],
  maxOverlapLength: number,
): string[] {
  const overlap: string[] = [];
  let length = 0;
  for (let index = units.length - 1; index >= 0; index -= 1) {
    const unit = units[index]!;
    if (length + unit.length > maxOverlapLength) break;
    overlap.unshift(unit);
    length += unit.length;
  }
  return overlap;
}

function collectSections(
  rawText: string,
  paragraphChunkDeep: number,
): FastGPTSection[] {
  const lines = rawText.split("\n");
  const sections: FastGPTSection[] = [];
  let current: FastGPTSection = { title: "", lines: [] };
  const headingStack: Array<{ level: number; line: string }> = [];
  let inFence = false;

  const flush = () => {
    if (current.lines.length) sections.push(current);
    current = { title: "", lines: [] };
  };

  for (const line of lines) {
    const heading = inFence ? null : getHeading(line);
    if (heading && heading.level <= paragraphChunkDeep) {
      flush();
      while (
        headingStack.length &&
        headingStack[headingStack.length - 1]!.level >= heading.level
      ) {
        headingStack.pop();
      }
      current = {
        title: heading.title,
        lines: [...headingStack.map((item) => item.line), line],
      };
      headingStack.push({ level: heading.level, line });
    } else {
      current.lines.push(line);
    }
    if (isFence(line)) inFence = !inFence;
  }
  flush();
  return sections;
}

function hasKnowledgeBody(content: string): boolean {
  const lines = content.split("\n");
  let inFence = false;
  for (const line of lines) {
    const isHeading = !inFence && Boolean(getHeading(line));
    if (!isHeading && line.trim()) return true;
    if (isFence(line)) inFence = !inFence;
  }
  return false;
}

function splitSectionContent(
  content: string,
  title: string,
  settings: FastGPTSplitSettings,
): string[] {
  if (settings.customSeparators.length) {
    return splitTextByCustomSeparators(
      content,
      settings.chunkSize,
      settings.customSeparators,
      settings.overlapRatio,
    );
  }
  if (content.length <= settings.chunkSize) return [content];

  const contentLines = content.split("\n");
  let headingLineCount = 0;
  while (headingLineCount < contentLines.length && getHeading(contentLines[headingLineCount]!)) {
    headingLineCount += 1;
  }
  const headingPrefix = title && headingLineCount
    ? `${contentLines.slice(0, headingLineCount).join("\n")}\n`
    : "";
  const body = headingPrefix ? content.slice(headingPrefix.length) : content;
  const bodySize = Math.max(1, settings.chunkSize - headingPrefix.length);
  const bodyChunks = splitTextRecursively(
    body,
    bodySize,
    0,
    settings.overlapRatio,
    settings.candidateTitleMode === "content",
  );
  return bodyChunks.map((chunk) => headingPrefix + chunk);
}

function splitText2ChunksFastGPT(
  rawText: string,
  settings: FastGPTSplitSettings,
): FastGPTChunk[] {
  const chunks: FastGPTChunk[] = [];
  for (const section of collectSections(rawText, settings.paragraphChunkDeep)) {
    const content = section.lines.join("\n");
    if (!content.trim() || !hasKnowledgeBody(content)) continue;
    for (const splitContent of splitSectionContent(content, section.title, settings)) {
      if (splitContent.trim()) {
        chunks.push({
          content: splitContent,
          title:
            settings.candidateTitleMode === "content"
              ? getGeneratedCandidateTitle(splitContent)
              : section.title,
        });
        if (chunks.length > KNOWLEDGE_FILE_MAX_CANDIDATES) {
          throw new KnowledgeFileParseError("knowledge_error.candidates_max");
        }
      }
    }
  }
  return chunks;
}

export function normalizeKnowledgeDuplicateContent(content: string): string {
  return normalizeLineEndings(content).normalize("NFC").trim();
}

export function splitKnowledgeFile(
  rawText: string,
  options: KnowledgeFileSplitOptions,
): KnowledgeFileCandidate[] {
  const settings = resolveFastGPTSettings(options);
  const normalizedText = normalizeLineEndings(rawText);
  const chunks = splitText2ChunksFastGPT(normalizedText, settings);
  const candidates: KnowledgeFileCandidate[] = [];

  for (const chunk of chunks) {
    if (!hasKnowledgeBody(chunk.content)) continue;
    candidates.push({ title: chunk.title, content: chunk.content });
    if (candidates.length > KNOWLEDGE_FILE_MAX_CANDIDATES) {
      throw new KnowledgeFileParseError("knowledge_error.candidates_max");
    }
  }

  if (candidates.length) return candidates;
  const fallbackContent = normalizedText.trim();
  if (!fallbackContent || !hasKnowledgeBody(fallbackContent)) return [];
  return [{ title: "", content: fallbackContent }];
}
