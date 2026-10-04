"use client";

import "katex/dist/katex.min.css";
import type { Element, ElementContent } from "hast";
import { Check, Copy } from "lucide-react";
import { memo, type ReactNode } from "react";
import ReactMarkdown, { type Components, type Options } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { useCopy } from "@/hooks/use-copy";
import { normalizeMath } from "@/lib/math";
import { siteName } from "@/lib/utils";

const remarkPlugins: Options["remarkPlugins"] = [
  // A lone "~" means "about" ("~$85K"), so only "~~" strikes text through.
  [remarkGfm, { singleTilde: false }],
  // Likewise a lone "$" is a dollar sign: normalizeMath turns each piece of math into $$…$$.
  [remarkMath, { singleDollarTextMath: false }],
];
const rehypePlugins: Options["rehypePlugins"] = [
  // Before highlighting, which would treat the math as code. A formula KaTeX can't read shows as
  // written, in muted text rather than KaTeX's red, and sizes are capped so one can't draw a
  // giant box over the page.
  [rehypeKatex, { errorColor: "var(--color-fg-muted)", strict: false, maxSize: 20 }],
  rehypeHighlight,
];

const components: Components = {
  a: ({ href, title, children }) => {
    const site = citedSite(href, children);
    return (
      <a
        href={href}
        title={title}
        target="_blank"
        rel="noopener noreferrer"
        className={site && "citation"}
      >
        {site ?? children}
      </a>
    );
  },
  pre: ({ node, children }) => <CodeBlock node={node}>{children}</CodeBlock>,
  table: ({ children }) => (
    <div className="table-wrapper">
      <table>{children}</table>
    </div>
  ),
};

/** Renders assistant markdown (GFM, math, highlighted code). Raw HTML is not rendered. */
export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {normalizeMath(content)}
      </ReactMarkdown>
    </div>
  );
});

function CodeBlock({ node, children }: { node?: Element; children?: ReactNode }) {
  const code = node?.children.find(
    (child): child is Element => child.type === "element" && child.tagName === "code",
  );
  const language = languageOf(code);
  const { copied, copy } = useCopy();

  return (
    <div className="code-block">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-1.5 text-xs text-fg-muted">
        <span>{language ?? "text"}</span>
        <button
          type="button"
          onClick={() => copy(textOf(code).replace(/\n$/, ""))}
          className="-mr-2 flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-hover hover:text-fg [&_svg]:size-3.5"
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

/**
 * The site a link cites, when it's written the way models cite search results: labeled with the
 * site's domain, like [reuters.com](https://www.reuters.com/…), or numbered, like [1](…).
 */
function citedSite(href: string | undefined, children: ReactNode): string | undefined {
  const site = href && siteName(href);
  if (!site || typeof children !== "string") return undefined;
  const label = children.trim().toLowerCase().replace(/^www\./, "");
  if (/^\[?\d+\]?$/.test(label)) return site;
  return label.includes(".") && (site === label || site.endsWith(`.${label}`)) ? label : undefined;
}

function languageOf(code: Element | undefined): string | undefined {
  const classes = code?.properties.className;
  if (!Array.isArray(classes)) return undefined;
  for (const name of classes) {
    if (typeof name === "string" && name.startsWith("language-")) return name.slice(9);
  }
  return undefined;
}

function textOf(node: ElementContent | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textOf).join("");
  return "";
}
