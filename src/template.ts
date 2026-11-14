/**
 * Parsing helpers for `${...}` templates.
 *
 * A config value is either a single template (`${expr}`), whose evaluated value is used as-is so
 * numbers, arrays and objects survive, or a string with one or more templates embedded in it
 * (`sensor.${model}_power`), whose parts are evaluated and joined back into a string.
 */

export type TemplatePart = { kind: 'text'; value: string } | { kind: 'code'; value: string };

const skipQuoted = (text: string, start: number, quote: string): number => {
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') {
      i++;
    } else if (text[i] === quote) {
      return i;
    }
  }
  return -1;
};

const skipTemplateLiteral = (text: string, start: number): number => {
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\') {
      i++;
    } else if (ch === '`') {
      return i;
    } else if (ch === '$' && text[i + 1] === '{') {
      const end = findClosingBrace(text, i + 1);
      if (end < 0) {
        return -1;
      }
      i = end;
    }
  }
  return -1;
};

/**
 * Returns the index of the `}` that closes the `{` at `openBrace`, skipping braces inside string
 * and template literals. Returns -1 when the brace is never closed.
 */
export const findClosingBrace = (text: string, openBrace: number): number => {
  let depth = 0;
  for (let i = openBrace; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return i;
      }
    } else if (ch === '"' || ch === "'") {
      i = skipQuoted(text, i, ch);
    } else if (ch === '`') {
      i = skipTemplateLiteral(text, i);
    }

    if (i < 0) {
      return -1;
    }
  }
  return -1;
};

/**
 * Splits a string into literal text and `${...}` code parts. An unterminated `${` is kept as
 * literal text rather than raising a confusing error.
 */
export const splitTemplate = (template: string): TemplatePart[] => {
  const parts: TemplatePart[] = [];
  let cursor = 0;

  while (cursor < template.length) {
    const start = template.indexOf('${', cursor);
    const end = start < 0 ? -1 : findClosingBrace(template, start + 1);

    if (start < 0 || end < 0) {
      parts.push({ kind: 'text', value: template.slice(cursor) });
      break;
    }

    if (start > cursor) {
      parts.push({ kind: 'text', value: template.slice(cursor, start) });
    }
    parts.push({ kind: 'code', value: template.slice(start + 2, end) });
    cursor = end + 1;
  }

  return parts;
};

/**
 * Returns the code of a value that is exactly one `${...}` template (ignoring surrounding
 * whitespace, which YAML block scalars often add), or undefined for anything else.
 */
export const singleTemplateCode = (template: string): string | undefined => {
  const trimmed = template.trim();
  if (!trimmed.startsWith('${') || !trimmed.endsWith('}')) {
    return undefined;
  }

  return findClosingBrace(trimmed, 1) === trimmed.length - 1 ? trimmed.slice(2, -1) : undefined;
};
