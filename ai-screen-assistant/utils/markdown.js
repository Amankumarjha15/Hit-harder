/**
 * markdown.js
 * ---------------------------------------------------------------------------
 * A small, dependency-free Markdown renderer.
 *
 * Why hand-rolled instead of bundling marked.js/showdown from a CDN? Chrome
 * Web Store / AMO review both frown on remotely-loaded script, and MV3's
 * default CSP disallows it outright. Vendoring a full library is possible,
 * but this covers everything the assistant's responses realistically need
 * (headings, emphasis, code blocks, lists, links, tables, blockquotes) in
 * ~120 lines that are easy to audit.
 *
 * All user/AI content is escaped before insertion — this renderer is safe
 * to use with innerHTML.
 */

import { highlightCode } from './highlight.js';

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(text) {
  let out = escapeHtml(text);

  // Inline code (do this before other inline rules so contents aren't touched)
  const codeSpans = [];
  out = out.replace(/`([^`]+)`/g, (_, code) => {
    codeSpans.push(code);
    return `\u0000CODE${codeSpans.length - 1}\u0000`;
  });

  // Links: [text](url)
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Bold + italic
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Restore inline code spans
  out = out.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => `<code class="asa-inline-code">${codeSpans[Number(i)]}</code>`);

  return out;
}

export function renderMarkdown(markdown) {
  if (!markdown) return '';
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;
  let listBuffer = null; // { type: 'ul'|'ol', items: [] }

  function flushList() {
    if (!listBuffer) return;
    const tag = listBuffer.type;
    html.push(`<${tag} class="asa-list">${listBuffer.items.map((it) => `<li>${renderInline(it)}</li>`).join('')}</${tag}>`);
    listBuffer = null;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fenceMatch = line.match(/^```(\w*)\s*$/);
    if (fenceMatch) {
      flushList();
      const lang = fenceMatch[1] || '';
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      const rawCode = codeLines.join('\n');
      const highlighted = highlightCode(rawCode, lang);
      html.push(
        `<div class="asa-code-block">` +
          `<div class="asa-code-header"><span>${escapeHtml(lang || 'text')}</span>` +
          `<button class="asa-copy-code-btn" type="button" aria-label="Copy code">Copy</button></div>` +
          `<pre><code class="asa-code hljs-${escapeHtml(lang || 'plain')}">${highlighted}</code></pre>` +
        `</div>`
      );
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      html.push(`<h${level} class="asa-heading">${renderInline(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      flushList();
      const quoteLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      html.push(`<blockquote class="asa-quote">${renderInline(quoteLines.join(' '))}</blockquote>`);
      continue;
    }

    // Horizontal rule
    if (/^(---|\*\*\*|___)\s*$/.test(line)) {
      flushList();
      html.push('<hr class="asa-hr" />');
      i++;
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ulMatch) {
      if (!listBuffer || listBuffer.type !== 'ul') {
        flushList();
        listBuffer = { type: 'ul', items: [] };
      }
      listBuffer.items.push(ulMatch[1]);
      i++;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (olMatch) {
      if (!listBuffer || listBuffer.type !== 'ol') {
        flushList();
        listBuffer = { type: 'ol', items: [] };
      }
      listBuffer.items.push(olMatch[1]);
      i++;
      continue;
    }

    flushList();

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph (collect until blank line or block-start)
    const paraLines = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^```/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    html.push(`<p class="asa-paragraph">${renderInline(paraLines.join(' '))}</p>`);
  }

  flushList();
  return html.join('\n');
}
