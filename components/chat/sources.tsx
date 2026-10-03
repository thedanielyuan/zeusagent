"use client";

import { useState } from "react";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import type { Source } from "@/lib/types";
import { cn, siteName } from "@/lib/utils";

/** "Sources" with the first few sites' icons. Opens the list of pages the reply's searches found. */
export function SourcesMenu({ sources }: { sources: Source[] }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className="ml-1 flex h-8 shrink-0 items-center gap-2 rounded-full px-2 text-xs font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg data-[state=open]:bg-hover data-[state=open]:text-fg"
        >
          <SiteIcons sources={sources} />
          Sources
        </button>
      </MenuTrigger>
      <MenuContent
        align="start"
        className="max-h-[min(var(--radix-dropdown-menu-content-available-height),420px)] w-[min(360px,calc(100vw-1rem))] overflow-y-auto"
      >
        <MenuLabel>{sources.length === 1 ? "1 source" : `${sources.length} sources`}</MenuLabel>
        {sources.map(({ url, title }) => (
          <MenuItem key={url} asChild className="items-start">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <SiteIcon url={url} className="mt-0.5" />
              <span className="min-w-0">
                <span className="line-clamp-2 leading-5">{title}</span>
                <span className="block truncate text-xs text-fg-subtle">{siteName(url)}</span>
              </span>
            </a>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

/** The icons of the first few sites among `sources`, overlapping. */
export function SiteIcons({ sources }: { sources: Source[] }) {
  const sites = new Map<string, string>();
  for (const { url } of sources) {
    const site = siteName(url) ?? url;
    if (sites.size === 3) break;
    if (!sites.has(site)) sites.set(site, url);
  }

  return (
    <span className="flex -space-x-1.5">
      {[...sites.values()].map((url) => (
        <SiteIcon key={url} url={url} className="ring-2 ring-app" />
      ))}
    </span>
  );
}

/** A site's icon on a light disc, which keeps dark icons visible on black. */
function SiteIcon({ url, className }: { url: string; className?: string }) {
  const site = siteName(url) ?? url;
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-white",
        className,
      )}
    >
      {failed ? (
        <span className="text-[10px] font-semibold text-neutral-600 uppercase">{site[0]}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- 14px icons from other sites; nothing for next/image to optimize
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(site)}&sz=32`}
          alt=""
          width={14}
          height={14}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="size-3.5"
        />
      )}
    </span>
  );
}
