/**
 * highlight.js (not the CDN library — a small hand-rolled highlighter)
 * ---------------------------------------------------------------------------
 * Generic, regex-based tokenizer that handles the common cases well enough
 * to be genuinely useful: strings, comments, numbers, keywords, and
 * function-call names. It intentionally does not try to be a full grammar
 * for every language — that's what pulls in a real dependency. Output is
 * HTML-escaped and wrapped in <span class="tok-*"> so overlay.css can style
 * it consistently with the rest of the UI.
 */

const KEYWORDS_BY_LANG = {
  javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'extends', 'new', 'await', 'async', 'import', 'export', 'from', 'default', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'switch', 'case', 'break', 'continue', 'this', 'super', 'null', 'undefined', 'true', 'false'],
  typescript: ['interface', 'type', 'implements', 'public', 'private', 'protected', 'readonly', 'enum', 'namespace', 'declare', 'as'],
  python: ['def', 'return', 'if', 'elif', 'else', 'for', 'while', 'class', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise', 'with', 'lambda', 'yield', 'pass', 'break', 'continue', 'in', 'is', 'not', 'and', 'or', 'None', 'True', 'False', 'self'],
  java: ['public', 'private', 'protected', 'class', 'static', 'void', 'new', 'return', 'if', 'else', 'for', 'while', 'try', 'catch', 'finally', 'import', 'package', 'extends', 'implements', 'this', 'super', 'null', 'true', 'false'],
  bash: ['if', 'then', 'else', 'fi', 'for', 'do', 'done', 'while', 'function', 'echo', 'export', 'return'],
  json: ['true', 'false', 'null'],
  css: [],
  html: [],
  sql: ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'TABLE', 'AND', 'OR', 'NOT', 'NULL', 'ORDER', 'BY', 'GROUP', 'LIMIT']
};

function normalizeLang(lang) {
  const l = (lang || '').toLowerCase();
  const alias = { js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript', py: 'python', sh: 'bash', shell: 'bash', yml: 'yaml' };
  return alias[l] || l;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function highlightCode(code, lang) {
  const normalized = normalizeLang(lang);
  const keywords = KEYWORDS_BY_LANG[normalized] || [];
  const keywordSet = new Set(keywords);

  // Tokenize with a single combined regex, longest/most-specific patterns first.
  const tokenRegex = new RegExp(
    [
      /(\/\/[^\n]*)/.source,                       // line comment (//)
      /(#[^\n]*)/.source,                           // line comment (#)
      /(\/\*[\s\S]*?\*\/)/.source,                  // block comment
      /("(?:[^"\\]|\\.)*")/.source,                 // double-quoted string
      /('(?:[^'\\]|\\.)*')/.source,                 // single-quoted string
      /(`(?:[^`\\]|\\.)*`)/.source,                 // template literal
      /(\b\d+(?:\.\d+)?\b)/.source,                 // number
      /([A-Za-z_$][A-Za-z0-9_$]*(?=\())/.source,    // function call name
      /(\b[A-Za-z_][A-Za-z0-9_]*\b)/.source         // generic word (checked against keyword set)
    ].join('|'),
    'g'
  );

  let result = '';
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(code)) !== null) {
    result += escapeHtml(code.slice(lastIndex, match.index));
    const [full, comment1, comment2, blockComment, dstr, sstr, tmpl, num, fnCall, word] = match;

    if (comment1 || comment2 || blockComment) {
      result += `<span class="tok-comment">${escapeHtml(full)}</span>`;
    } else if (dstr || sstr || tmpl) {
      result += `<span class="tok-string">${escapeHtml(full)}</span>`;
    } else if (num) {
      result += `<span class="tok-number">${escapeHtml(full)}</span>`;
    } else if (fnCall) {
      result += `<span class="tok-function">${escapeHtml(full)}</span>`;
    } else if (word && keywordSet.has(word)) {
      result += `<span class="tok-keyword">${escapeHtml(full)}</span>`;
    } else {
      result += escapeHtml(full);
    }
    lastIndex = tokenRegex.lastIndex;
  }
  result += escapeHtml(code.slice(lastIndex));
  return result;
}
