import { useEffect, useState } from "react";
import { loadAttachment } from "@/lib/attachments";

/** An object URL for a sent attachment's file: undefined while it loads, null if it's gone. */
export function useAttachmentUrl(id: string): string | null | undefined {
  const [loaded, setLoaded] = useState<{ id: string; url: string | null }>();

  useEffect(() => {
    let url: string | undefined;
    let cancelled = false;
    void loadAttachment(id).then((blob) => {
      if (cancelled) return;
      url = blob && URL.createObjectURL(blob);
      setLoaded({ id, url: url ?? null });
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  return loaded?.id === id ? loaded.url : undefined;
}
