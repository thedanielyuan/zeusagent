"use client";

import { Check, ChevronDown } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { Menu, MenuContent, MenuTrigger } from "@/components/ui/menu";
import { setModel } from "@/lib/actions";
import { MODELS, getModel } from "@/lib/models";
import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ModelSelector() {
  const hydrated = useChatStore((state) => state.hydrated);
  const modelId = useChatStore((state) => state.modelId);
  const current = getModel(modelId) ?? MODELS[0];

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          // Hidden until the saved choice loads, so it doesn't flash the default model.
          className={cn(
            "flex h-9 min-w-0 items-center gap-1 rounded-lg px-2.5 text-lg text-fg transition-colors hover:bg-hover data-[state=open]:bg-hover",
            !hydrated && "invisible",
          )}
        >
          <span className="truncate font-medium">{current.name}</span>
          <ChevronDown className="size-4 shrink-0 text-fg-muted" />
        </button>
      </MenuTrigger>
      <MenuContent
        align="start"
        className="max-h-[min(70dvh,560px)] w-[min(340px,calc(100vw-1rem))] overflow-y-auto"
      >
        <DropdownMenu.Label className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-fg-subtle">
          Model
        </DropdownMenu.Label>
        <DropdownMenu.RadioGroup value={modelId} onValueChange={setModel}>
          {MODELS.map((model) => (
            <DropdownMenu.RadioItem
              key={model.id}
              value={model.id}
              className="group flex cursor-pointer select-none items-center gap-3 rounded-lg px-2.5 py-2 outline-none data-[highlighted]:bg-hover"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-fg group-data-[state=checked]:text-accent">
                  {model.name}
                </div>
                <div className="truncate text-xs text-fg-muted">{model.description}</div>
              </div>
              <DropdownMenu.ItemIndicator>
                <Check className="size-4 text-accent" />
              </DropdownMenu.ItemIndicator>
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </MenuContent>
    </Menu>
  );
}
