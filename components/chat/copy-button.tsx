"use client";

import { Check, Copy } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { useCopy } from "@/hooks/use-copy";

export function CopyButton({ text }: { text: string }) {
  const { copied, copy } = useCopy();
  return (
    <IconButton
      label={copied ? "Copied!" : "Copy"}
      onClick={() => copy(text)}
      className="size-8 [&_svg]:size-4"
    >
      {copied ? <Check /> : <Copy />}
    </IconButton>
  );
}
