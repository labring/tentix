import { describe, expect, test } from "bun:test";
import {
  normalizeKnowledgeDuplicateContent,
  splitKnowledgeFile,
} from "../utils/kb/file-import.ts";
import { parseKnowledgeFile } from "../utils/kb/file-parsers.ts";
import { unzipSync, zipSync } from "fflate";
import * as XLSX from "xlsx";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytes(value: string): Uint8Array {
  return textEncoder.encode(value);
}

function createDocxFixture(includeMedia = false): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": bytes(
      `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    ),
    "_rels/.rels": bytes(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    ),
    "word/document.xml": bytes(
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>DOCX text</w:t></w:r></w:p><w:sectPr/></w:body>
</w:document>`,
    ),
  };
  if (includeMedia) files["word/media/image.png"] = new Uint8Array([1, 2, 3]);
  return zipSync(files);
}

function createXlsxFixture(includeMedia = false): Uint8Array {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Name", "Value"],
      ["A", "1"],
    ]),
    "Sheet 1",
  );
  const workbookBytes = new Uint8Array(
    XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
  );
  if (!includeMedia) return workbookBytes;

  const files = unzipSync(workbookBytes);
  files["xl/media/image1.png"] = new Uint8Array([1, 2, 3]);
  return zipSync(files);
}

function createXlsxCommentFixture(): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([["Value"]]);
  worksheet["A1"].c = [{ a: "test", t: "payload" }];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet 1");

  const files = unzipSync(
    new Uint8Array(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })),
  );
  const commentsPath = Object.keys(files).find((path) =>
    path.startsWith("xl/comments"),
  );
  if (!commentsPath) {
    throw new Error("XLSX comment part was not created");
  }
  files[commentsPath] = new Uint8Array(
    textEncoder.encode(
      textDecoder
        .decode(files[commentsPath]!)
        .replace(/ref="A1"/, 'ref="__proto__"'),
    ),
  );
  return zipSync(files);
}

function createPdfFixture(text: string): Uint8Array {
  const content = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(output.length);
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return bytes(output);
}

const customOptions = (overrides: Record<string, unknown> = {}) => ({
  chunkSettingMode: "custom" as const,
  chunkSplitMode: "paragraph" as const,
  paragraphChunkDeep: 2,
  chunkSize: 1200,
  ...overrides,
});

describe("knowledge file import parser", () => {
  test("custom paragraph depth 2 keeps H3 content inside the H2 candidate", () => {
    const candidates = splitKnowledgeFile(
      "# 支付\n\n前言说明\n\n## 退款\n\n退款说明\n\n### 处理方式\n\n处理说明\n\n## 订单\n\n订单说明",
      customOptions(),
    );

    expect(candidates).toHaveLength(3);
    expect(candidates[0]?.title).toBe("支付");
    expect(candidates[0]?.content).toContain("前言说明");
    expect(candidates[1]?.title).toBe("退款");
    expect(candidates[1]?.content).toContain("## 退款");
    expect(candidates[1]?.content).toContain("### 处理方式");
    expect(candidates[2]?.title).toBe("订单");
    expect(candidates[2]?.content).toContain("## 订单");
  });

  test("creates an H1 candidate for direct H1 content", () => {
    const candidates = splitKnowledgeFile(
      "# 支付说明\n\n支付正文",
      customOptions(),
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.title).toBe("支付说明");
    expect(candidates[0]?.content).toContain("# 支付说明");
  });

  test("keeps H3 content under H1 when paragraph depth is 2", () => {
    const candidates = splitKnowledgeFile(
      "# 支付\n\n说明\n\n### 处理方式\n\n处理说明",
      customOptions(),
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.title).toBe("支付");
    expect(candidates[0]?.content).toContain("### 处理方式");
  });

  test("keeps one empty-title candidate when no usable heading exists", () => {
    const candidates = splitKnowledgeFile(
      "### 处理方式\n\n处理说明",
      customOptions(),
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.title).toBe("");
    expect(candidates[0]?.content).toContain("### 处理方式");
  });

  test("uses an absolute H2 title when the document has no H1", () => {
    const [candidate] = splitKnowledgeFile(
      "## 退款\n\n退款说明",
      customOptions(),
    );

    expect(candidate?.title).toBe("退款");
    expect(candidate?.content).toContain("## 退款");
  });

  test("keeps title empty for text without a heading", () => {
    const [candidate] = splitKnowledgeFile("普通文本", customOptions());
    expect(candidate?.title).toBe("");
  });

  test("does not treat headings inside fenced code as boundaries", () => {
    const [candidate] = splitKnowledgeFile(
      "# 示例\n\n```md\n## 代码中的标题\n```\n\n正文",
      customOptions(),
    );

    expect(candidate?.title).toBe("示例");
    expect(candidate?.content).toContain("## 代码中的标题");
  });

  test("splits long content with FastGPT paragraph rules and rejects over-limit output", () => {
    const text = "第一段。".repeat(2000);
    const chunks = splitKnowledgeFile(
      text,
      customOptions({ chunkSize: 200 }),
    );
    expect(chunks.length).toBeGreaterThan(1);
    expect(() =>
      splitKnowledgeFile(
        text,
      customOptions({ chunkSize: 64, paragraphChunkDeep: 2 }),
      ),
    ).toThrow();
  });

  test("starts length-split candidates at complete sentence boundaries", () => {
    const text = Array.from(
      { length: 80 },
      (_, index) => `第${index + 1}句内容。`,
    ).join("");
    const chunks = splitKnowledgeFile(
      text,
      customOptions({ chunkSize: 64 }),
    );

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks.slice(1)) {
      expect(chunk.content).toMatch(/^第\d+句内容。/);
    }
  });

  test("size mode ignores heading boundaries and derives editable titles from candidate content", () => {
    const text = "# 标题\n\n" + "第一个句子。第二个句子。".repeat(80);
    const chunks = splitKnowledgeFile(
      text,
      customOptions({ chunkSplitMode: "size", paragraphChunkDeep: 0, chunkSize: 64 }),
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.title).toBe("标题");
    expect(chunks[0]?.content).toContain("# 标题");
    expect(chunks.some((chunk) => chunk.content.includes("# 标题"))).toBe(true);
    expect(chunks.every((chunk) => chunk.title.trim().length > 0)).toBe(true);
    expect(chunks.every((chunk) => chunk.title.length <= 80)).toBe(true);
  });

  test("char mode splits by literal custom separators without overlap", () => {
    const chunks = splitKnowledgeFile(
      "第一段\n\n第二段====第三段",
      customOptions({
        chunkSplitMode: "char",
        chunkSplitter: "\\n\\n|====",
        chunkSize: 1200,
      }),
    );

    expect(chunks.map((chunk) => chunk.content)).toEqual(["第一段", "第二段", "第三段"]);
    expect(chunks.map((chunk) => chunk.title)).toEqual(["第一段", "第二段", "第三段"]);
  });

  test("char mode retains a heading before long content", () => {
    const text = "# 标题\n\n" + "正文。".repeat(80);
    const chunks = splitKnowledgeFile(
      text,
      customOptions({
        chunkSplitMode: "char",
        chunkSplitter: "\\n\\n",
        chunkSize: 64,
      }),
    );

    expect(chunks[0]?.title).toBe("标题");
    expect(chunks[0]?.content).toContain("# 标题");
    expect(chunks.some((chunk) => chunk.content.includes("# 标题"))).toBe(true);
  });

  test("does not create a candidate from a heading without body in size mode", () => {
    expect(
      splitKnowledgeFile(
        "# 只有标题",
        customOptions({ chunkSplitMode: "size", paragraphChunkDeep: 0 }),
      ),
    ).toHaveLength(0);
  });

  test("limits long extracted titles without changing candidate content", () => {
    const text = "长文本".repeat(100) + "。";
    const [chunk] = splitKnowledgeFile(
      text,
      customOptions({ chunkSplitMode: "size", paragraphChunkDeep: 0, chunkSize: 1200 }),
    );

    expect(chunk?.title.length).toBeLessThanOrEqual(80);
    expect(chunk?.content).toContain(text);
  });

  test("rejects an empty, over-count, or over-length custom separator setting", () => {
    for (const chunkSplitter of ["", "a||b", "a|b|c|d|e|f|g|h|i|j|k", "a".repeat(201)]) {
      expect(() =>
        splitKnowledgeFile(
          "内容",
          customOptions({ chunkSplitMode: "char", chunkSplitter }),
        ),
      ).toThrow("knowledge_error.chunk_splitter");
    }
  });

  test("filters a heading without a knowledge body", () => {
    expect(
      splitKnowledgeFile("# 只有标题", customOptions()),
    ).toHaveLength(0);
  });

  test("default mode uses FastGPT paragraph settings without client numeric options", () => {
    const candidates = splitKnowledgeFile("# 标题\n\n正文", {
      chunkSettingMode: "auto",
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.content).toContain("# 标题");
  });

  test("paragraph depth 1 does not split H2 and depth 3 can split H3", () => {
    const text = "# 一级\n\n## 二级\n\n二级正文\n\n### 三级\n\n三级正文";
    const depth1 = splitKnowledgeFile(
      text,
      customOptions({ paragraphChunkDeep: 1 }),
    );
    const depth3 = splitKnowledgeFile(
      text,
      customOptions({ paragraphChunkDeep: 3 }),
    );
    expect(depth1).toHaveLength(1);
    expect(depth3).toHaveLength(2);
    expect(depth3[1]?.title).toBe("三级");
  });

  test("normalizes only outer whitespace and line endings for duplicate checks", () => {
    expect(normalizeKnowledgeDuplicateContent("  a\r\nb  ")).toBe("a\nb");
    expect(normalizeKnowledgeDuplicateContent("a  b")).not.toBe("a b");
  });

  test("parses markdown and ignores image syntax with a warning", async () => {
    const result = await parseKnowledgeFile({
      fileName: "guide.md",
      bytes: bytes("# Title\n\nText ![image](image.png) remains"),
    });
    expect(result.rawText).toContain("# Title");
    expect(result.rawText).not.toContain("![image]");
    expect(result.warningKeys).toEqual(["knowledge_warning.unsupported_content"]);
  });

  test("parses html text and ignores media nodes with a warning", async () => {
    const result = await parseKnowledgeFile({
      fileName: "guide.html",
      bytes: bytes("<h1>Title</h1><p>Text</p><img src='x.png'><svg></svg>"),
    });
    expect(result.rawText).toContain("Title");
    expect(result.rawText).toContain("Text");
    expect(result.rawText).not.toContain("x.png");
    expect(result.warningKeys).toEqual(["knowledge_warning.unsupported_content"]);
  });

  test("parses csv into text that can enter the existing splitter", async () => {
    const result = await parseKnowledgeFile({
      fileName: "table.csv",
      bytes: bytes("Name,Value\nA,1\nB,2"),
    });
    expect(result.rawText).toContain("| Name | Value |");
    expect(result.rawText).toContain("| A | 1 |");
    expect(result.warningKeys).toHaveLength(0);
  });

  test("parses docx and xlsx text while warning about media", async () => {
    const docxResult = await parseKnowledgeFile({
      fileName: "guide.docx",
      bytes: createDocxFixture(true),
    });
    expect(docxResult.rawText).toContain("DOCX text");
    expect(docxResult.warningKeys).toEqual(["knowledge_warning.unsupported_content"]);

    const xlsxResult = await parseKnowledgeFile({
      fileName: "table.xlsx",
      bytes: createXlsxFixture(true),
    });
    expect(xlsxResult.rawText).toContain("| Name | Value |");
    expect(xlsxResult.warningKeys).toEqual(["knowledge_warning.unsupported_content"]);
  });

  test("does not pollute Object.prototype when parsing xlsx comments", async () => {
    const key = "c";
    const objectPrototype = Object.prototype as Record<string, unknown>;
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      Object.prototype,
      key,
    );
    delete objectPrototype[key];

    try {
      const result = await parseKnowledgeFile({
        fileName: "comment.xlsx",
        bytes: createXlsxCommentFixture(),
      });
      expect(result.rawText).toContain("| Value |");
      expect(
        Object.prototype.hasOwnProperty.call(Object.prototype, key),
      ).toBe(false);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(Object.prototype, key, originalDescriptor);
      } else {
        delete objectPrototype[key];
      }
    }
  });

  test("parses a text-layer pdf and rejects an empty-text pdf", async () => {
    const result = await parseKnowledgeFile({
      fileName: "guide.pdf",
      bytes: createPdfFixture("PDF text"),
    });
    expect(result.rawText).toContain("PDF text");

    await expect(
      parseKnowledgeFile({ fileName: "scan.pdf", bytes: createPdfFixture("") }),
    ).rejects.toMatchObject({ translationKey: "knowledge_error.file_no_text" });
  });

  test("rejects an encrypted pdf marker", async () => {
    await expect(
      parseKnowledgeFile({
        fileName: "encrypted.pdf",
        bytes: bytes("%PDF-1.4\ntrailer\n<< /Encrypt 5 0 R >>\n%%EOF"),
      }),
    ).rejects.toMatchObject({ translationKey: "knowledge_error.file_encrypted" });
  });

  test("rejects unsupported, oversized, malformed, and empty files", async () => {
    await expect(
      parseKnowledgeFile({ fileName: "slide.pptx", bytes: new Uint8Array([1]) }),
    ).rejects.toMatchObject({ translationKey: "knowledge_error.file_extension" });
    await expect(
      parseKnowledgeFile({
        fileName: "large.txt",
        bytes: new Uint8Array(10 * 1024 * 1024 + 1),
      }),
    ).rejects.toMatchObject({ translationKey: "knowledge_error.file_size" });
    await expect(
      parseKnowledgeFile({ fileName: "bad.docx", bytes: new Uint8Array([1, 2, 3]) }),
    ).rejects.toThrow();
    await expect(
      parseKnowledgeFile({ fileName: "invalid.txt", bytes: new Uint8Array([0xff]) }),
    ).rejects.toMatchObject({ translationKey: "knowledge_error.file_corrupt" });
    await expect(
      parseKnowledgeFile({ fileName: "empty.txt", bytes: new Uint8Array() }),
    ).rejects.toMatchObject({ translationKey: "knowledge_error.file_no_text" });
  });
});
