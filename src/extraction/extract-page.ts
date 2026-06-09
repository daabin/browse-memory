import { Readability } from "@mozilla/readability";

export interface ExtractedPage {
  url: string;
  title: string;
  content: string;
}

export function extractPage(
  sourceDocument: Document,
  url = sourceDocument.location?.href ?? "",
): ExtractedPage {
  const fallbackTitle = sourceDocument.title.trim() || new URL(url).hostname;
  try {
    const parsed = new Readability(sourceDocument.cloneNode(true) as Document).parse();
    const content = parsed?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    return {
      url,
      title: parsed?.title?.trim() || fallbackTitle,
      content,
    };
  } catch {
    return { url, title: fallbackTitle, content: "" };
  }
}
