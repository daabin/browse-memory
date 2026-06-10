import { type ReactNode } from "react";

/**
 * Lightweight Markdown renderer.
 *
 * Supported block elements: headings, code blocks, lists (ol/ul), blockquotes,
 * tables, horizontal rules, paragraphs.
 * Supported inline elements: bold, italic, inline code, links, strikethrough, citation [n].
 */

// ── Inline parsing ──────────────────────────────────────────────────

type CitationHandler = (index: number) => void;

function parseInline(text: string, onCitation?: CitationHandler): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Regex order: citation [n], inline code, bold, italic, strikethrough, link [text](url)
  const INLINE_RE = /(\[(\d+)\])|(`[^`]+`)|(\*\*(.+?)\*\*)|(\*(.+?)\*)|(~~(.+?)~~)|(\[([^\]]+)\]\(([^)]+)\))/g;

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
    } else if (match[9]) {
      // Strikethrough
      nodes.push(<del key={`d${match.index}`}>{match[9]}</del>);
    } else if (match[11] && match[12]) {
      // Link
      nodes.push(
        <a key={`a${match.index}`} href={match[12]} target="_blank" rel="noopener noreferrer" className="md-link">
          {match[11]}
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
  | { type: "blockquote"; lines: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "hr" }
  | { type: "paragraph"; text: string };

function isSpecialLine(line: string): boolean {
  return (
    line.startsWith("```") ||
    /^#{1,6}\s+/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    line.startsWith("> ") ||
    line === ">" ||
    /^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)
  );
}

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

    // Horizontal rule
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ") || line === ">") {
      const bqLines: string[] = [];
      while (i < lines.length && (lines[i].startsWith("> ") || lines[i] === ">")) {
        bqLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "blockquote", lines: bqLines });
      continue;
    }

    // Table: header row + separator row + data rows
    if (line.includes("|") && i + 1 < lines.length && /^\|?[\s\-:|]+\|?$/.test(lines[i + 1])) {
      const parseRow = (row: string) =>
        row.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      const headers = parseRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(parseRow(lines[i]));
        i++;
      }
      blocks.push({ type: "table", headers, rows });
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
      !isSpecialLine(lines[i])
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
    case "blockquote":
      return (
        <blockquote key={key} className="md-blockquote">
          {block.lines.map((l, j) => (
            <p key={j} className="md-p">{parseInline(l, onCitation)}</p>
          ))}
        </blockquote>
      );
    case "table":
      return (
        <div key={key} className="md-table-wrap">
          <table className="md-table">
            <thead>
              <tr>{block.headers.map((h, j) => <th key={j}>{parseInline(h, onCitation)}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{parseInline(cell, onCitation)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "hr":
      return <hr key={key} className="md-hr" />;
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
