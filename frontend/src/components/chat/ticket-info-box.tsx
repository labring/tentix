import type { TicketType } from "tentix-server/rpc";
import { useTranslation } from "i18n";
import { type JSONContent } from "@tiptap/react";
import { PhotoProvider, PhotoView } from "react-photo-view";
import ContentRenderer from "./content-renderer.tsx";
import { useTicketModules, getModuleTranslation } from "@store/app-config";

function separateContent(content: JSONContent): {
  textContent: JSONContent;
  images: JSONContent[];
} {
  const textContent: JSONContent = { type: "doc", content: [] };
  const images: JSONContent[] = [];

  function processNode(node: JSONContent): JSONContent | null {
    if (!node) return null;

    if (node.type === "image") {
      images.push(node);
      return null; // 不在文字内容中包含图片
    }

    if (node.content && node.content.length > 0) {
      const filteredContent = node.content
        .map((child) => processNode(child))
        .filter((child) => child !== null) as JSONContent[];

      if (filteredContent.length > 0) {
        return { ...node, content: filteredContent };
      } else if (node.type === "paragraph") {
        return null; // 空段落不保留
      }
    }

    return node;
  }

  if (content.content) {
    const processedContent = content.content
      .map((node) => processNode(node))
      .filter((node) => node !== null) as JSONContent[];

    textContent.content = processedContent;
  }

  return { textContent, images };
}

export function TicketInfoBox({ ticket }: { ticket: TicketType }) {
  const { i18n } = useTranslation();
  const ticketModules = useTicketModules();
  const { textContent, images } = separateContent(ticket.description);

  return (
    <div className="flex flex-col mb-10 px-6 py-5 gap-2 border border-zinc-200 bg-white rounded-xl shadow-sm">
      {/* Title */}
      <div className="flex flex-row justify-between items-start">
        <p className="text-zinc-900 text-base font-semibold leading-6 flex-1 pr-4">
          {ticket.title}
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center justify-center gap-1 py-1 px-3 rounded-md border border-gray-200 text-xs font-medium text-zinc-900 bg-gray-50">
            {(() => {
              const currentLang = i18n.language === "zh" ? "zh-CN" : "en-US";
              return getModuleTranslation(
                ticket.module,
                currentLang,
                ticketModules,
              );
            })()}
          </span>
        </div>
      </div>

      {/* Text content */}
      {textContent.content && textContent.content.length > 0 && (
        <div className="mb-4 text-sm text-gray-700 leading-relaxed">
          <ContentRenderer doc={textContent} />
        </div>
      )}

      {/* Images */}
      {images.length > 0 && (
        <div className="space-y-2">
          <PhotoProvider>
            {images.map((image, index) => (
              <div key={index} className="w-full">
                <PhotoView src={image.attrs?.src || ""}>
                  <img
                    src={image.attrs?.src || ""}
                    alt={image.attrs?.alt || ""}
                    title={image.attrs?.title || ""}
                    className="cursor-pointer rounded border border-gray-200 object-cover w-full"
                    style={{ maxWidth: "100%", height: "170px" }}
                  />
                </PhotoView>
              </div>
            ))}
          </PhotoProvider>
        </div>
      )}
    </div>
  );
}
