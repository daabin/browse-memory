import { type ReactNode } from "react";

/**
 * Lightweight Markdown renderer for assistant chat messages.
 *
 * Supported block elements: headings, code blocks, lists (ol/ul), paragraphs.
 * Supported inline elements: bold, italic, inline code, links, citation [n].
 */

// ── Inline parsing ──────────────────────────────────────────────────

type CitationHandler = (index: number) => void;

function parseInline(text: string, onCitation?: CitationHandler): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Regex order: citation [n], inline code, bold, italic, link [text](url)
  const INLINE_RE = /(\[(\d+)\])|(`[^`]+`)|(\*\*(.+?)\*\*)|(\*(.+?)\*)|(\[([^\]]+)\]\(([^)]+)\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_RE.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // Citation [n]
      const n = Number(match[2]);
      if (onCitation) {
        nodes.push(
          <button key={`c${match.index}`} type="button" className="citation-link" onClick={() => onCitation(n)}>
            [{n}]
          </button>,
        );
      } else {
        nodes.push(`[${n}]`);
      }
    } else if (match[3]) {
      // Inline code
      nodes.push(<code key={`ic${match.index}`} className="md-inline-code">{match[3].slice(1, -1)}</code>);
    } else if (match[5]) {
      // Bold
      nodes.push(<strong key={`b${match.index}`}>{parseInline(match[5], onCitation)}</strong>);
    } else if (match[7]) {
      // Italic
      nodes.push(<em key={`i${match.index}`}>{parseInline(match[7], onCitation)}</em>);
    } else if (match[9] && match[10]) {
      // Link
      nodes.push(
        <a key={`a${match.index}`} href={match[10]} target="_blank" rel="noopener noreferrer" className="md-link">
          {match[9]}
        </a>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Trailing plain text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

// ── Block parsing ───────────────────────────────────────────────────

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "code"; lang: string; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "paragraph"; text: string };

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: "code", lang, text: codeLines.join("\n") });
      continue;
    }

    // Heading
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1].length, text: headingMatch[2] });
      i++;
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph (collect consecutive non-blank, non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("```") &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", text: paraLines.join("\n") });
    }
  }

  return blocks;
}

// ── Block rendering ─────────────────────────────────────────────────

function renderBlock(block: Block, key: number, onCitation?: CitationHandler): ReactNode {
  switch (block.type) {
    case "heading": {
      const Tag = `h${Math.min(block.level, 4)}` as "h1" | "h2" | "h3" | "h4";
      return <Tag key={key} className={`md-h${block.level}`}>{parseInline(block.text, onCitation)}</Tag>;
    }
    case "code":
      return (
        <pre key={key} className="md-code-block">
          <code>{block.text}</code>
        </pre>
      );
    case "ul":
      return (
        <ul key={key} className="md-ul">
          {block.items.map((item, j) => (
            <li key={j}>{parseInline(item, onCitation)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} className="md-ol">
          {block.items.map((item, j) => (
            <li key={j}>{parseInline(item, onCitation)}</li>
          ))}
        </ol>
      );
    case "paragraph":
      return <p key={key} className="md-p">{parseInline(block.text, onCitation)}</p>;
  }
}

// ── Public component ────────────────────────────────────────────────

export function MarkdownContent({
  text,
  onCitation,
}: {
  text: string;
  onCitation?: CitationHandler;
}) {
  const blocks = parseBlocks(text);
  return <div className="md-content">{blocks.map((b, i) => renderBlock(b, i, onCitation))}</div>;
}
