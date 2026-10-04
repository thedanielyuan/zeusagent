"use client";

import { Download, FileText, ImageOff, LoaderCircle, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { useAttachmentUrl } from "@/hooks/use-attachment-url";
import type { PendingAttachment } from "@/lib/attachments";
import type { Attachment } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A file in the message box, waiting to be sent. */
export interface DraftAttachment {
  /** Identifies it in the message box. */
  key: string;
  name: string;
  pdf: boolean;
  /** An object URL of the picked image, for its preview. */
  previewUrl?: string;
  /** What gets sent, once the file is read (and an image resized). */
  ready?: PendingAttachment;
}

interface ComposerAttachmentsProps {
  attachments: DraftAttachment[];
  onRemove: (key: string) => void;
}

/** The files added to the message box, each with a button to remove it. */
export function ComposerAttachments({ attachments, onRemove }: ComposerAttachmentsProps) {
  return (
    <ul aria-label="Attachments" className="flex flex-wrap gap-2 px-1 pt-1 pb-2.5">
      {attachments.map(({ key, name, pdf, previewUrl, ready }) => (
        <li key={key} className="group/attachment relative">
          {pdf ? (
            <PdfCard name={name} detail="PDF" />
          ) : (
            <span className="block size-14 overflow-hidden rounded-xl bg-raised">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL; nothing for next/image to optimize */}
              <img src={previewUrl} alt={name} className="size-full object-cover" />
            </span>
          )}
          {!ready && (
            <span
              role="status"
              aria-label={`Preparing ${name}`}
              className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50"
            >
              <LoaderCircle className="size-5 animate-spin text-fg" />
            </span>
          )}
          <button
            type="button"
            aria-label={`Remove ${name}`}
            onClick={() => onRemove(key)}
            className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-fg text-black opacity-0 shadow-md shadow-black/50 transition-opacity group-hover/attachment:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <X className="size-3" strokeWidth={3} />
          </button>
        </li>
      ))}
    </ul>
  );
}

interface MessageAttachmentsProps {
  attachments: Attachment[];
  className?: string;
}

/** The images and PDFs sent with a message, shown above its text. */
export function MessageAttachments({ attachments, className }: MessageAttachmentsProps) {
  const images = attachments.filter(({ mimeType }) => mimeType.startsWith("image/"));
  const pdfs = attachments.filter(({ mimeType }) => !mimeType.startsWith("image/"));

  return (
    <div className={cn("flex max-w-[85%] flex-col items-end gap-2 sm:max-w-[70%]", className)}>
      {images.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2">
          {images.map((image) => (
            <ChatImage
              key={image.id}
              image={image}
              fit={images.length === 1 ? SENT_IMAGE_FIT : undefined}
            />
          ))}
        </div>
      )}
      {pdfs.map((pdf) => (
        <SentPdf key={pdf.id} pdf={pdf} />
      ))}
    </div>
  );
}

/** The largest a lone sent image is shown, in pixels; several are shown as squares. */
const SENT_IMAGE_FIT = { width: 320, height: 288 };

interface ChatImageProps {
  image: Attachment;
  /** The box it's scaled down to fit, keeping its shape. Without one, a square thumbnail. */
  fit?: { width: number; height: number };
  /** A description, e.g. the model's caption for an image it created. Its name otherwise. */
  alt?: string;
}

/** A sent or created image, which opens full size in a viewer. */
export function ChatImage({ image, fit, alt = image.name }: ChatImageProps) {
  const url = useAttachmentUrl(image.id);
  const [viewing, setViewing] = useState(false);
  const { width = 1, height = 1 } = image;
  // Sized before the image loads, so the chat doesn't jump.
  const style = fit && {
    width: Math.min(width, fit.width, (fit.height * width) / height),
    aspectRatio: `${width} / ${height}`,
  };

  if (url === null) {
    return (
      <span
        title={`${image.name} is no longer saved in this browser`}
        style={style}
        className={cn(
          "flex max-w-full flex-col items-center justify-center gap-1 rounded-2xl bg-surface p-2 text-xs text-fg-subtle",
          !fit && "size-32",
        )}
      >
        <ImageOff className="size-5" />
        Unavailable
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={`View ${alt}`}
        onClick={() => setViewing(true)}
        style={style}
        className={cn("block max-w-full overflow-hidden rounded-2xl bg-surface", !fit && "size-32")}
      >
        {url && (
          // eslint-disable-next-line @next/next/no-img-element -- a local object URL; nothing for next/image to optimize
          <img src={url} alt={alt} className="size-full object-cover" />
        )}
      </button>
      {url && (
        <ImageViewer
          url={url}
          name={image.name}
          alt={alt}
          open={viewing}
          onOpenChange={setViewing}
        />
      )}
    </>
  );
}

interface ImageViewerProps {
  url: string;
  /** The file name, for downloads. */
  name: string;
  alt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The image as large as the window allows, with a download button. A click elsewhere closes it. */
function ImageViewer({ url, name, alt, open, onOpenChange }: ImageViewerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/85 data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          onClick={() => onOpenChange(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none data-[state=open]:animate-pop-in sm:p-10"
        >
          <Dialog.Title className="sr-only">{alt}</Dialog.Title>
          {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL; nothing for next/image to optimize */}
          <img src={url} alt={alt} className="max-h-full max-w-full rounded-lg object-contain" />
          <div className="absolute top-3 right-3 flex gap-1">
            <a
              href={url}
              download={name}
              aria-label={`Download ${name}`}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex size-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-hover hover:text-fg [&_svg]:size-5"
            >
              <Download />
            </a>
            <Dialog.Close asChild>
              <IconButton label="Close" tooltip={false}>
                <X />
              </IconButton>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Opens the PDF in a new tab, in the browser's PDF viewer. */
function SentPdf({ pdf }: { pdf: Attachment }) {
  const url = useAttachmentUrl(pdf.id);
  const card = (
    <PdfCard name={pdf.name} detail={url === null ? "Unavailable" : `PDF · ${formatSize(pdf.size)}`} />
  );
  if (!url) return card;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${pdf.name}`}
      className="rounded-xl transition-opacity hover:opacity-80"
    >
      {card}
    </a>
  );
}

function PdfCard({ name, detail }: { name: string; detail: string }) {
  return (
    <span className="flex h-14 w-60 max-w-full items-center gap-2.5 rounded-xl border border-line bg-raised px-2.5 text-left">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
        <FileText className="size-5 text-fg" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-fg">{name}</span>
        <span className="block text-xs text-fg-subtle">{detail}</span>
      </span>
    </span>
  );
}

/** "540 KB", "2.3 MB". */
function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
