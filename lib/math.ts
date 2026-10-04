/**
 * Models write math in several ways: \(…\) and \[…\] (most GPT, Gemini and DeepSeek replies), $…$
 * and $$…$$. With single-dollar math off, remark-math reads $$…$$ inside text as inline math and
 * $$ fences on their own lines as display math, and leaves a lone $ as a dollar sign. This
 * rewrites the other forms into those two, outside code.
 *
 * A single $ opens math only the way Pandoc reads it: followed by a non-space, and closed by a $
 * after a non-space that isn't followed by a digit. Math that starts with a digit can't contain
 * spaces either. So "$x^2$" and "$2^n$" are math, but prices like "$5 and $10" aren't.
 */
export function normalizeMath(markdown: string): string {
  if (!/[$\\]/.test(markdown)) return markdown;
  return splitCode(markdown)
    .map(({ code, value }) => (code ? value : convertMath(value)))
    .join("");
}

// The steps below run in this order, and each hides the math it finds from the later ones.

/** $$…$$ filling its lines: display math. */
const DOLLAR_DISPLAY = /^([ \t]*)(?<!\\)\$\$((?:(?!\$\$)[\s\S])+?)\$\$[ \t]*$/gm;
/** $$…$$ within a line: already inline math. */
const DOLLAR_INLINE = /(?<!\\)\$\$((?:(?!\$\$)[\s\S])+?)\$\$/g;
/** \[…\] filling its lines: display math. */
const BRACKET_DISPLAY = /^([ \t]*)(?<!\\)\\\[((?:(?!\\\])[\s\S])+?)\\\][ \t]*$/gm;
/** \[…\] within a line: inline math, or escaped brackets like "\[1\]" (see looksLikeMath). */
const BRACKET_INLINE = /(?<!\\)\\\[((?:(?!\\\])[\s\S])+?)\\\]/g;
/** \(…\): inline math. */
const PAREN_INLINE = /(?<!\\)\\\(((?:(?!\\\))[\s\S])+?)\\\)/g;
/** $…$ (see normalizeMath): math starting with a digit, then any other math. */
const DOLLAR_SINGLE =
  /(?<![\\$])\$(?:(?=\d)((?:\\.|[^$\\\s\u0000])+?)|(?![\s$\d])((?:\\.|[^$\\\n\u0000])+?))(?<!\s)\$(?![\d$])/g;

function convertMath(text: string): string {
  const hidden: string[] = [];
  const hide = (math: string) => `\u0000${hidden.push(math) - 1}\u0000`;

  const display = (_: string, indent: string, tex: string) => hide(displayMath(indent, tex));
  const inline = (match: string, tex: string) => (tex.trim() ? hide(inlineMath(tex)) : match);

  return text
    .replace(DOLLAR_DISPLAY, display)
    .replace(DOLLAR_INLINE, (match) => hide(match))
    .replace(BRACKET_DISPLAY, display)
    .replace(BRACKET_INLINE, (match, tex: string) =>
      looksLikeMath(tex) ? inline(match, tex) : match,
    )
    .replace(PAREN_INLINE, inline)
    .replace(DOLLAR_SINGLE, (match, startsWithDigit?: string, tex?: string) =>
      inline(match, startsWithDigit ?? tex ?? ""),
    )
    .replace(/\u0000(\d+)\u0000/g, (_, index: string) => hidden[Number(index)]);
}

/** $$ fences around the math, indented like the lines they replace so they stay in a list item. */
function displayMath(indent: string, tex: string): string {
  const lines = tex
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return [`${indent}$$`, ...lines.map((line) => indent + line), `${indent}$$`].join("\n");
}

function inlineMath(tex: string): string {
  return `$$${tex.trim().replace(/\s*\n\s*/g, " ")}$$`;
}

/** Whether \[…\] within a line holds math rather than escaped brackets, like "\[1\]". */
function looksLikeMath(tex: string): boolean {
  return /[\\^_={}<>+]/.test(tex);
}

interface Part {
  code: boolean;
  value: string;
}

/** A fence opening a code block. A ``` fence's info string can't hold a backtick. */
const OPENING_FENCE = /^[ \t]*(`{3,}(?=[^`]*$)|~{3,})/;
const CLOSING_FENCE = /^[ \t]*(`{3,}|~{3,})[ \t]*\r?\n?$/;
/** A code span: a run of backticks through the next run of as many, within a paragraph. */
const CODE_SPAN = /(?<!`)(`+)(?!`)(?:(?!\n[ \t]*\n)[\s\S])*?(?<!`)\1(?!`)/g;

/** Splits markdown into code (blocks and spans, left as written) and the text around it. */
function splitCode(markdown: string): Part[] {
  const parts: Part[] = [];
  let text = "";
  let block = "";
  let fence: string | undefined;

  for (const line of markdown.split(/(?<=\n)/)) {
    if (fence === undefined) {
      const opening = OPENING_FENCE.exec(line);
      if (opening) {
        parts.push(...splitCodeSpans(text));
        text = "";
        block = line;
        fence = opening[1];
      } else {
        text += line;
      }
    } else {
      block += line;
      const closing = CLOSING_FENCE.exec(line);
      if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length) {
        parts.push({ code: true, value: block });
        block = "";
        fence = undefined;
      }
    }
  }
  // A block still streaming in runs to the end.
  parts.push(...(fence === undefined ? splitCodeSpans(text) : [{ code: true, value: block }]));
  return parts;
}

function splitCodeSpans(text: string): Part[] {
  const parts: Part[] = [];
  let end = 0;
  for (const match of text.matchAll(CODE_SPAN)) {
    parts.push({ code: false, value: text.slice(end, match.index) });
    parts.push({ code: true, value: match[0] });
    end = match.index + match[0].length;
  }
  parts.push({ code: false, value: text.slice(end) });
  return parts;
}
