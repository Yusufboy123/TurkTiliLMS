import type { ReactNode } from 'react';

function parseInlineFormatting(text: string): ReactNode[] {
  // Regex to split by bold (**text**), italic (*text* or _text_), and inline code (`text`)
  const parts: ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // Bold **text**
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)$/s);
    // Inline code `text`
    const codeMatch = remaining.match(/^(.*?)(?:`(.+?)`)(.*)$/s);
    // Italic *text*
    const italicMatch = remaining.match(/^(.*?)\*(.+?)\*(.*)$/s);

    // Pick the earliest match
    type MatchType = { type: 'bold' | 'code' | 'italic'; index: number; before: string; content: string; after: string };
    const matches: MatchType[] = [];

    if (boldMatch) {
      matches.push({ type: 'bold', index: boldMatch[1].length, before: boldMatch[1], content: boldMatch[2], after: boldMatch[3] });
    }
    if (codeMatch) {
      matches.push({ type: 'code', index: codeMatch[1].length, before: codeMatch[1], content: codeMatch[2], after: codeMatch[3] });
    }
    if (italicMatch) {
      matches.push({ type: 'italic', index: italicMatch[1].length, before: italicMatch[1], content: italicMatch[2], after: italicMatch[3] });
    }

    if (matches.length === 0) {
      parts.push(<span key={`text-${keyIdx++}`}>{remaining}</span>);
      break;
    }

    // Sort by earliest match index
    matches.sort((a, b) => a.index - b.index);
    const first = matches[0];

    if (first.before) {
      parts.push(<span key={`text-${keyIdx++}`}>{first.before}</span>);
    }

    if (first.type === 'bold') {
      parts.push(
        <strong className="font-semibold text-text-primary" key={`bold-${keyIdx++}`}>
          {first.content}
        </strong>
      );
    } else if (first.type === 'code') {
      parts.push(
        <code className="rounded bg-subtle px-1.5 py-0.5 font-mono text-body-sm text-action-primary-text" key={`code-${keyIdx++}`}>
          {first.content}
        </code>
      );
    } else if (first.type === 'italic') {
      parts.push(
        <em className="italic text-text-secondary" key={`italic-${keyIdx++}`}>
          {first.content}
        </em>
      );
    }

    remaining = first.after;
  }

  return parts;
}

export function RichTextContent({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];
  let tableRows: string[][] = [];
  let inTable = false;

  const flushList = () => {
    if (!listItems.length) return;
    nodes.push(
      <ul className="my-3 list-disc space-y-2 pl-6 text-body-md text-text-primary" key={`list-${nodes.length}`}>
        {listItems.map((item, i) => (
          <li key={i}>{parseInlineFormatting(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  const flushTable = () => {
    if (!tableRows.length) return;
    const headerRow = tableRows[0];
    const dataRows = tableRows.slice(1);

    nodes.push(
      <div className="my-5 overflow-x-auto rounded-lg border border-border-decorative bg-surface shadow-subtle" key={`table-${nodes.length}`}>
        <table className="w-full text-left text-body-sm">
          {headerRow ? (
            <thead className="border-b border-border-decorative bg-subtle/80 text-label-md uppercase tracking-wider text-text-secondary">
              <tr>
                {headerRow.map((cell, idx) => (
                  <th className="px-4 py-3" key={idx}>
                    {parseInlineFormatting(cell)}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody className="divide-y divide-border-decorative">
            {dataRows.map((row, rowIdx) => (
              <tr className="hover:bg-subtle/40 transition-colors" key={rowIdx}>
                {row.map((cell, cellIdx) => (
                  <td className="px-4 py-3 text-body-md" key={cellIdx}>
                    {parseInlineFormatting(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Check table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      const cells = trimmed
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());

      // Skip markdown table separator rows like |:---|:---|
      if (cells.every((cell) => /^:?-+:?$/.test(cell))) {
        return;
      }
      tableRows.push(cells);
      inTable = true;
      return;
    } else if (inTable) {
      flushTable();
    }

    if (!trimmed) {
      flushList();
      return;
    }

    // Heading 2 or 3
    const heading = trimmed.match(/^(#{2,3})\s+(.+)$/);
    if (heading?.[2]) {
      flushList();
      const isH2 = heading[1] === '##';
      nodes.push(
        isH2 ? (
          <h2 className="mt-8 mb-3 type-heading-2 border-b border-border-decorative/60 pb-2 text-text-primary first:mt-0" key={`h2-${index}`}>
            {parseInlineFormatting(heading[2])}
          </h2>
        ) : (
          <h3 className="mt-6 mb-2 type-heading-3 text-text-primary" key={`h3-${index}`}>
            {parseInlineFormatting(heading[2])}
          </h3>
        )
      );
      return;
    }

    // Bullet or numbered list
    const bullet = trimmed.match(/^(?:[-•]|\d+[.)])\s+(.+)$/);
    if (bullet?.[1]) {
      listItems.push(bullet[1]);
      return;
    }

    flushList();

    // Callout box match: Eslab qoling / Muhim / Qoida / Ko'p uchraydigan xato / Diqqat
    const callout = trimmed.match(/^(Eslab qoling|Muhim|Qoida|Ko'p uchraydigan xato|Diqqat):\s*(.*)$/i);
    if (callout?.[1] && callout[2]) {
      const type = callout[1].toLowerCase();
      let borderClass = 'border-l-4 border-l-action-primary-bg border-border-decorative bg-subtle/50';
      let titleClass = 'text-action-primary-text';
      let icon = '📌';

      if (type.includes('eslab')) {
        borderClass = 'border-l-4 border-l-info-border border-info-border bg-info-bg/40';
        titleClass = 'text-info-text';
        icon = '💡';
      } else if (type.includes('muhim') || type.includes('diqqat')) {
        borderClass = 'border-l-4 border-l-warning-border border-warning-border bg-warning-bg/40';
        titleClass = 'text-warning-text';
        icon = '⚠️';
      } else if (type.includes('xato')) {
        borderClass = 'border-l-4 border-l-danger-border border-danger-border bg-danger-bg/40';
        titleClass = 'text-danger-text';
        icon = '🚫';
      }

      nodes.push(
        <aside className={`my-5 rounded-r-lg border p-4 text-body-md ${borderClass}`} key={`callout-${index}`}>
          <p className={`font-semibold text-label-md flex items-center gap-2 ${titleClass}`}>
            <span>{icon}</span> {callout[1]}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-text-primary">{parseInlineFormatting(callout[2])}</p>
        </aside>
      );
      return;
    }

    // Standard paragraph
    nodes.push(
      <p className="my-3 text-body-lg leading-8 text-text-primary first:mt-0 last:mb-0" key={`para-${index}`}>
        {parseInlineFormatting(trimmed)}
      </p>
    );
  });

  flushList();
  flushTable();

  return <div className="space-y-1">{nodes}</div>;
}
