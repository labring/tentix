import { expect, test, describe } from "bun:test";
import { markdownToTipTapJSON, convertTokensToTipTapJSON } from "../utils/md";
import markdownit from "markdown-it";

describe("Markdown to TipTap JSON Converter", () => {
  test("should convert simple heading", () => {
    const markdown = "# Hello World";
    const result = markdownToTipTapJSON(markdown);

    expect(result.type).toBe("doc");
    expect(result.content).toHaveLength(1);
    expect(result.content?.[0]?.type).toBe("heading");
    expect(result.content?.[0]?.attrs?.level).toBe(1);
    expect(result.content?.[0]?.content?.[0]?.text).toBe("Hello World");
  });

  test("should convert multiple heading levels", () => {
    const markdown = `# H1
## H2
### H3`;
    const result = markdownToTipTapJSON(markdown);

    expect(result.content).toHaveLength(3);
    expect(result.content?.[0]?.attrs?.level).toBe(1);
    expect(result.content?.[1]?.attrs?.level).toBe(2);
    expect(result.content?.[2]?.attrs?.level).toBe(3);
  });

  test("should convert simple paragraph", () => {
    const markdown = "This is a simple paragraph.";
    const result = markdownToTipTapJSON(markdown);

    expect(result.content).toHaveLength(1);
    expect(result.content?.[0]?.type).toBe("paragraph");
    expect(result.content?.[0]?.content?.[0]?.text).toBe(
      "This is a simple paragraph.",
    );
  });

  test("should convert bold text", () => {
    const markdown = "This is **bold text** in a paragraph.";
    const result = markdownToTipTapJSON(markdown);
    
    const paragraph = result.content?.[0];
    expect(paragraph?.content).toHaveLength(3);
    expect(paragraph?.content?.[0]?.text).toBe("This is ");
    expect(paragraph?.content?.[1]?.text).toBe("bold text");
    expect(paragraph?.content?.[1]?.marks?.[0]?.type).toBe("bold");
    expect(paragraph?.content?.[2]?.text).toBe(" in a paragraph.");
  });

  test("should convert italic text", () => {
    const markdown = "This is *italic text* in a paragraph.";
    const result = markdownToTipTapJSON(markdown);
    
    const paragraph = result.content?.[0];
    expect(paragraph?.content).toHaveLength(3);
    expect(paragraph?.content?.[0]?.text).toBe("This is ");
    expect(paragraph?.content?.[1]?.text).toBe("italic text");
    expect(paragraph?.content?.[1]?.marks?.[0]?.type).toBe("italic");
    expect(paragraph?.content?.[2]?.text).toBe(" in a paragraph.");
  });

  test("should convert italic text with underscore", () => {
    const markdown = "This is _italic text_ in a paragraph.";
    const result = markdownToTipTapJSON(markdown);
    
    const paragraph = result.content?.[0];
    expect(paragraph?.content).toHaveLength(3);
    expect(paragraph?.content?.[0]?.text).toBe("This is ");
    expect(paragraph?.content?.[1]?.text).toBe("italic text");
    expect(paragraph?.content?.[1]?.marks?.[0]?.type).toBe("italic");
    expect(paragraph?.content?.[2]?.text).toBe(" in a paragraph.");
  });

  test("should convert mixed bold and italic text", () => {
    const markdown = "Text with **bold** and *italic* formatting.";
    const result = markdownToTipTapJSON(markdown);
    
    const paragraph = result.content?.[0];
    expect(paragraph?.content).toHaveLength(5);
    expect(paragraph?.content?.[0]?.text).toBe("Text with ");
    expect(paragraph?.content?.[1]?.text).toBe("bold");
    expect(paragraph?.content?.[1]?.marks?.[0]?.type).toBe("bold");
    expect(paragraph?.content?.[2]?.text).toBe(" and ");
    expect(paragraph?.content?.[3]?.text).toBe("italic");
    expect(paragraph?.content?.[3]?.marks?.[0]?.type).toBe("italic");
    expect(paragraph?.content?.[4]?.text).toBe(" formatting.");
  });

  test("should convert links", () => {
    const markdown = "Visit [Google](https://google.com) for search.";
    const result = markdownToTipTapJSON(markdown);

    const paragraph = result.content?.[0];
    expect(paragraph?.content).toHaveLength(3);
    expect(paragraph?.content?.[0]?.text).toBe("Visit ");
    expect(paragraph?.content?.[1]?.text).toBe("Google");
    expect(paragraph?.content?.[1]?.marks?.[0]?.type).toBe("link");
    expect(paragraph?.content?.[1]?.marks?.[0]?.attrs?.href).toBe(
      "https://google.com",
    );
    expect(paragraph?.content?.[2]?.text).toBe(" for search.");
  });

  test("should convert images", () => {
    const markdown = "![alt text](./image.png)";
    const result = markdownToTipTapJSON(markdown);

    const paragraph = result.content?.[0];
    expect(paragraph?.content).toHaveLength(1);
    expect(paragraph?.content?.[0]?.type).toBe("image");
    expect(paragraph?.content?.[0]?.attrs?.src).toBe("./image.png");
    expect(paragraph?.content?.[0]?.attrs?.alt).toBe("alt text");
    expect(paragraph?.content?.[0]?.attrs?.id).toBe(null);
    expect(paragraph?.content?.[0]?.attrs?.title).toBe(null);
    expect(paragraph?.content?.[0]?.attrs?.width).toBe(null);
    expect(paragraph?.content?.[0]?.attrs?.height).toBe(null);
    expect(paragraph?.content?.[0]?.attrs?.fileName).toBe(null);
  });

  test("should convert image with empty alt text", () => {
    const markdown = "![](./image.png)";
    const result = markdownToTipTapJSON(markdown);

    const paragraph = result.content?.[0];
    const image = paragraph?.content?.[0];
    expect(image?.type).toBe("image");
    expect(image?.attrs?.src).toBe("./image.png");
    expect(image?.attrs?.alt).toBe("");
  });

  test("should convert ordered list", () => {
    const markdown = `1. First item
2. Second item
3. Third item`;
    const result = markdownToTipTapJSON(markdown);

    expect(result.content).toHaveLength(1);
    expect(result.content?.[0]?.type).toBe("orderedList");
    expect(result.content?.[0]?.content).toHaveLength(3);

    const firstItem = result.content?.[0]?.content?.[0];
    expect(firstItem?.type).toBe("listItem");
    expect(firstItem?.content?.[0]?.content?.[0]?.text).toBe("First item");
  });

  test("should convert bullet list", () => {
    const markdown = `- First item
- Second item
- Third item`;
    const result = markdownToTipTapJSON(markdown);

    expect(result.content).toHaveLength(1);
    expect(result.content?.[0]?.type).toBe("bulletList");
    expect(result.content?.[0]?.content).toHaveLength(3);

    const firstItem = result.content?.[0]?.content?.[0];
    expect(firstItem?.type).toBe("listItem");
    expect(firstItem?.content?.[0]?.content?.[0]?.text).toBe("First item");
  });

  test("should convert list with bold text", () => {
    const markdown = `1. **Bold item** with regular text
2. Another item`;
    const result = markdownToTipTapJSON(markdown);

    const firstItem = result.content?.[0]?.content?.[0];
    const paragraph = firstItem?.content?.[0];
    expect(paragraph?.content).toHaveLength(3);
    expect(paragraph?.content?.[1]?.text).toBe("Bold item");
    expect(paragraph?.content?.[1]?.marks?.[0]?.type).toBe("bold");
  });

  test("should convert complex markdown with multiple elements", () => {
    const markdown = `# Main Title

This is a paragraph with **bold text**, *italic text*, and a [link](https://example.com).

![Sample Image](./sample.png)

## Features

1. **Easy to use** - Simple API
2. *Fast* - Efficient parsing
3. **Flexible** - Various elements

- Bullet point 1
- Bullet point 2`;

    const result = markdownToTipTapJSON(markdown);
    
    expect(result.type).toBe("doc");
    expect(result.content).toHaveLength(6);
    
    // Check heading
    expect(result.content?.[0]?.type).toBe("heading");
    expect(result.content?.[0]?.attrs?.level).toBe(1);
    
    // Check paragraph with formatting
    expect(result.content?.[1]?.type).toBe("paragraph");
    
    // Check image
    expect(result.content?.[2]?.type).toBe("paragraph");
    expect(result.content?.[2]?.content?.[0]?.type).toBe("image");
    
    // Check second heading
    expect(result.content?.[3]?.type).toBe("heading");
    expect(result.content?.[3]?.attrs?.level).toBe(2);
    
    // Check ordered list
    expect(result.content?.[4]?.type).toBe("orderedList");
    
    // Check bullet list
    expect(result.content?.[5]?.type).toBe("bulletList");
  });

  test("should handle empty markdown", () => {
    const markdown = "";
    const result = markdownToTipTapJSON(markdown);
    
    expect(result.type).toBe("doc");
    expect(result.content).toHaveLength(0);
  });

  test("should handle markdown with only whitespace", () => {
    const markdown = "   \n\n   ";
    const result = markdownToTipTapJSON(markdown);
    
    expect(result.type).toBe("doc");
    expect(result.content).toHaveLength(0);
  });

  test("convertTokensToTipTapJSON should work with pre-parsed tokens", () => {
    const markdown = "# Test Heading";
    const tokens = markdownit().parse(markdown, {});
    const result = convertTokensToTipTapJSON(tokens);
    
    expect(result.type).toBe("doc");
    expect(result.content).toHaveLength(1);
    expect(result.content?.[0]?.type).toBe("heading");
    expect(result.content?.[0]?.content?.[0]?.text).toBe("Test Heading");
  });

  test("should handle mixed inline elements", () => {
    const markdown = "Text with **bold**, *italic*, [link](https://example.com), and ![image](./img.png) elements.";
    const result = markdownToTipTapJSON(markdown);
    
    const paragraph = result.content?.[0];
    expect(paragraph?.content).toHaveLength(9);
    
    // Check text
    expect(paragraph?.content?.[0]?.text).toBe("Text with ");
    
    // Check bold
    expect(paragraph?.content?.[1]?.text).toBe("bold");
    expect(paragraph?.content?.[1]?.marks?.[0]?.type).toBe("bold");
    
    // Check text
    expect(paragraph?.content?.[2]?.text).toBe(", ");
    
    // Check italic
    expect(paragraph?.content?.[3]?.text).toBe("italic");
    expect(paragraph?.content?.[3]?.marks?.[0]?.type).toBe("italic");
    
    // Check text
    expect(paragraph?.content?.[4]?.text).toBe(", ");
    
    // Check link
    expect(paragraph?.content?.[5]?.text).toBe("link");
    expect(paragraph?.content?.[5]?.marks?.[0]?.type).toBe("link");
    
    // Check text
    expect(paragraph?.content?.[6]?.text).toBe(", and ");
    
    // Check image
    expect(paragraph?.content?.[7]?.type).toBe("image");
    expect(paragraph?.content?.[7]?.attrs?.src).toBe("./img.png");
    
    // Check final text
    expect(paragraph?.content?.[8]?.text).toBe(" elements.");
  });
});
