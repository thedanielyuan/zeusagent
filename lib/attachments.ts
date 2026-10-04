import type { Attachment } from "./types";
import { createId } from "./utils";

/** A file picked for the next message, ready to send. */
export interface PendingAttachment extends Attachment {
  blob: Blob;
}

/** The most files one message can carry. */
export const MAX_ATTACHMENTS = 10;
/** What the file picker offers. */
export const ACCEPTED_FILES = "image/*,application/pdf";

const MAX_PDF_MB = 20;
/** Larger images aren't read at all; smaller ones are resized to MAX_IMAGE_SIDE. */
const MAX_IMAGE_MB = 50;
/**
 * The longest side images are sent at, in pixels. Models don't look closer than this, and every
 * turn sends the chat's images again, so bigger ones are scaled down.
 */
const MAX_IMAGE_SIDE = 2048;
/** Images of these types that are small enough are sent as they are; others are re-encoded. */
const SENDABLE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_UNCHANGED_IMAGE_BYTES = 4 * 1024 * 1024;

/** For files the browser doesn't give a type, e.g. some dragged in from other apps. */
const TYPES_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
};

/**
 * Reads a file the user picked, pasted or dropped, scaling images down to what the models use.
 * Throws with a message for the user when the file can't be sent.
 */
export async function prepareAttachment(file: File): Promise<PendingAttachment> {
  const mimeType = file.type || TYPES_BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""];
  if (mimeType === "application/pdf") {
    if (file.size > MAX_PDF_MB * 1024 * 1024) throw new Error(`${file.name} is over ${MAX_PDF_MB} MB.`);
    return { id: createId(), name: file.name, mimeType, size: file.size, blob: withType(file, mimeType) };
  }
  if (!mimeType?.startsWith("image/")) throw new Error(`${file.name} isn't an image or a PDF.`);
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) throw new Error(`${file.name} is over ${MAX_IMAGE_MB} MB.`);
  return prepareImage(file, mimeType);
}

async function prepareImage(file: File, mimeType: string): Promise<PendingAttachment> {
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error(`Couldn't read ${file.name}. Try a PNG or JPEG.`);
  }
  const { width, height } = image;
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height));
  if (
    scale === 1 &&
    SENDABLE_IMAGE_TYPES.includes(mimeType) &&
    file.size <= MAX_UNCHANGED_IMAGE_BYTES
  ) {
    image.close();
    const blob = withType(file, mimeType);
    return { id: createId(), name: file.name, mimeType, size: file.size, width, height, blob };
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error(`Couldn't read ${file.name}.`);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const blob = await encode(canvas, context);
  return {
    id: createId(),
    name: file.name,
    mimeType: blob.type,
    size: blob.size,
    width: canvas.width,
    height: canvas.height,
    blob,
  };
}

/** As WebP, which keeps transparency, or where browsers can't make WebP (Safari), JPEG on white. */
async function encode(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): Promise<Blob> {
  const webp = await canvasBlob(canvas, "image/webp");
  if (webp?.type === "image/webp") return webp;
  context.globalCompositeOperation = "destination-over";
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const jpeg = await canvasBlob(canvas, "image/jpeg");
  if (!jpeg) throw new Error("Couldn't prepare the image.");
  return jpeg;
}

function canvasBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));
}

function withType(file: File, type: string): Blob {
  return file.type === type ? file : new Blob([file], { type });
}

/**
 * Saves an image a model created (a base64 data URL), the same way as an attachment. `name` gets
 * the file extension, for downloads.
 */
export async function saveCreatedImage(data: string, name: string): Promise<Attachment> {
  const blob = await (await fetch(data)).blob();
  const extension = blob.type === "image/jpeg" ? "jpg" : blob.type.replace("image/", "");
  let width: number | undefined;
  let height: number | undefined;
  try {
    const image = await createImageBitmap(blob);
    ({ width, height } = image);
    image.close();
  } catch {
    // Shown without a known size; the browser may still manage to draw it.
  }
  const attachment: Attachment = {
    id: createId(),
    name: `${name}.${extension}`,
    mimeType: blob.type,
    size: blob.size,
    width,
    height,
  };
  saveAttachment({ ...attachment, blob });
  return attachment;
}

/** Saves a sent attachment's file, by its id. */
export function saveAttachment({ id, blob }: PendingAttachment) {
  files.set(id, Promise.resolve(blob));
  request("readwrite", (store) => store.put(blob, id)).catch((error: unknown) => {
    console.warn("Zeus couldn't save an attachment.", error);
  });
}

/** An attachment's file, or undefined if it's gone (say, the browser's site data was cleared). */
export function loadAttachment(id: string): Promise<Blob | undefined> {
  let file = files.get(id);
  if (!file) {
    file = request("readonly", (store) => store.get(id) as IDBRequest<Blob | undefined>).catch(
      () => undefined,
    );
    files.set(id, file);
  }
  return file;
}

/** An attachment as a base64 data URL, as /api/chat takes it. */
export async function attachmentData(id: string): Promise<string | undefined> {
  const blob = await loadAttachment(id);
  if (!blob) return undefined;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read an attachment."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Deletes the saved files of the attachments `inUse` leaves out. It's called once the saved files
 * are listed, so a file saved in the meantime counts as in use.
 */
export async function deleteAttachmentsExcept(inUse: () => ReadonlySet<string>) {
  try {
    const ids = await request("readonly", (store) => store.getAllKeys());
    const keep = inUse();
    const unused = ids.filter((id): id is string => typeof id === "string" && !keep.has(id));
    for (const id of unused) files.delete(id);
    await Promise.all(unused.map((id) => request("readwrite", (store) => store.delete(id))));
  } catch (error) {
    console.warn("Zeus couldn't delete unused attachments.", error);
  }
}

/** The files read or saved this session, by attachment id, so each is read from disk once. */
const files = new Map<string, Promise<Blob | undefined>>();

const DATABASE = "zeus";
const STORE = "attachments";
let database: Promise<IDBDatabase> | undefined;

function request<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  database ??= new Promise((resolve, reject) => {
    const open = indexedDB.open(DATABASE, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error("Couldn't open IndexedDB."));
  });
  return database.then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const pending = run(db.transaction(STORE, mode).objectStore(STORE));
        pending.onsuccess = () => resolve(pending.result);
        pending.onerror = () => reject(pending.error ?? new Error("IndexedDB request failed."));
      }),
  );
}
