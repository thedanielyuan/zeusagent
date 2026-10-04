"use client";

import "katex/dist/katex.min.css";
import type { Element, ElementContent } from "hast";
import { Check, Copy } from "lucide-react";
import { createContext, memo, useContext, type ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components, type Options } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { useCopy } from "@/hooks/use-copy";
import { normalizeMath } from "@/lib/math";
import type { Attachment } from "@/lib/types";
import { siteName } from "@/lib/utils";
import { ChatImage } from "./attachments";

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
  img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} />,
  pre: ({ node, children }) => <CodeBlock node={node}>{children}</CodeBlock>,
  table: ({ children }) => (
    <div className="table-wrapper">
      <table>{children}</table>
    </div>
  ),
};

/** Keeps the model's references to the images it created, which aren't web addresses. */
function urlTransform(url: string): string {
  return url.startsWith("attachment:") ? url : defaultUrlTransform(url);
}

interface MarkdownProps {
  content: string;
  /** Images the model created, which the content refers to as "attachment:…". */
  images?: Attachment[];
}

/** Renders assistant markdown (GFM, math, highlighted code). Raw HTML is not rendered. */
export const Markdown = memo(function Markdown({ content, images = NO_IMAGES }: MarkdownProps) {
  return (
    <div className="markdown">
      <CreatedImages value={images}>
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={components}
          urlTransform={urlTransform}
        >
          {numberImageReferences(normalizeMath(content))}
        </ReactMarkdown>
      </CreatedImages>
    </div>
  );
});

const NO_IMAGES: Attachment[] = [];
const CreatedImages = createContext(NO_IMAGES);

/**
 * A reference the model writes to an image it created, like ![A lighthouse](attachment:image):
 * the image tool's way of placing it in the reply.
 */
const IMAGE_REFERENCE = /!\[([^\]]*)\]\(attachment:[^)\s]*\)/g;

/** How many of the images a model created its reply places; the rest go after the reply. */
export function imageReferenceCount(content: string): number {
  return content.match(IMAGE_REFERENCE)?.length ?? 0;
}

/** The reply's text without its image references, e.g. for copying. */
export function withoutImageReferences(content: string): string {
  return content.replace(IMAGE_REFERENCE, "").trim();
}

/** Numbers the image references in order, so each shows the image created at that point. */
function numberImageReferences(markdown: string): string {
  let index = 0;
  return markdown.replace(IMAGE_REFERENCE, (_, alt: string) => `![${alt}](attachment:${index++})`);
}

/** A reference to an image the model created, or else a link to the image's address. */
function MarkdownImage({ src, alt }: { src?: string | Blob; alt?: string }) {
  const images = useContext(CreatedImages);
  if (typeof src !== "string" || !src) return null;
  if (src.startsWith("attachment:")) {
    const image = images[Number(src.slice("attachment:".length))];
    return image ? <ChatImage image={image} fit={CREATED_IMAGE_FIT} alt={alt || undefined} /> : null;
  }
  // Images from elsewhere aren't loaded, since loading one sends its address off: a web page the
  // model read could have it write chat text into an image address. A link leaves it to the user.
  return (
    <a href={src} target="_blank" rel="noopener noreferrer">
      {alt || siteName(src) || "Image"}
    </a>
  );
}

/** The largest an image the model created is shown in the reply, in pixels. */
export const CREATED_IMAGE_FIT = { width: 512, height: 512 };

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
