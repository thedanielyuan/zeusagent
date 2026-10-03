"use client";

import { ChevronDown } from "lucide-react";
import {
  Menu,
  MenuContent,
  MenuLabel,
  MenuOption,
  MenuRadioGroup,
  MenuTrigger,
} from "@/components/ui/menu";
import { setEffort, setModel } from "@/lib/actions";
import { EFFORTS, MODELS, effortName, getModel, isEffort, resolveEffort } from "@/lib/models";
import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const pillClass =
  "flex h-9 items-center gap-1 rounded-full px-2.5 text-sm text-fg-muted transition-colors hover:bg-hover hover:text-fg data-[state=open]:bg-hover data-[state=open]:text-fg [&_svg]:size-4 [&_svg]:shrink-0";

/** Dropped when the composer is phone-width, which leaves room for the full labels. */
function Chevron() {
  return <ChevronDown className="@max-[25rem]/composer:hidden" />;
}

function useCurrentModel() {
  return useChatStore((state) => getModel(state.modelId)) ?? MODELS[0];
}

export function ModelSelector() {
  const hydrated = useChatStore((state) => state.hydrated);
  const current = useCurrentModel();

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`Model: ${current.name}`}
          // Hidden until the saved choice loads, so it doesn't flash the default model.
          className={cn(pillClass, "min-w-0", !hydrated && "invisible")}
        >
          <span className="truncate">{current.name}</span>
          <Chevron />
        </button>
      </MenuTrigger>
      <MenuContent
        side="top"
        align="end"
        className="max-h-[min(var(--radix-dropdown-menu-content-available-height),560px)] w-[min(340px,calc(100vw-1rem))] overflow-y-auto"
      >
        <MenuLabel>Model</MenuLabel>
        <MenuRadioGroup value={current.id} onValueChange={setModel}>
          {MODELS.map((model) => (
            <MenuOption
              key={model.id}
              value={model.id}
              label={model.name}
              description={model.description}
            />
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

/** Reasoning effort for the current model. Hidden for models that can't reason. */
export function EffortSelector() {
  const hydrated = useChatStore((state) => state.hydrated);
  const preferred = useChatStore((state) => state.effort);
  const { reasoning } = useCurrentModel();
  if (!reasoning) return null;
  const effort = resolveEffort(reasoning, preferred);

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`Reasoning effort: ${effortName(effort)}`}
          className={cn(pillClass, "shrink-0", !hydrated && "invisible")}
        >
          {effortName(effort)}
          <Chevron />
        </button>
      </MenuTrigger>
      <MenuContent
        side="top"
        align="end"
        className="max-h-(--radix-dropdown-menu-content-available-height) w-[min(300px,calc(100vw-1rem))] overflow-y-auto"
      >
        <MenuLabel>Reasoning effort</MenuLabel>
        <MenuRadioGroup
          value={effort}
          onValueChange={(value) => {
            if (isEffort(value)) setEffort(value);
          }}
        >
          {EFFORTS.filter(({ id }) => reasoning.efforts.includes(id)).map(({ id, name, description }) => (
            <MenuOption
              key={id}
              value={id}
              label={name}
              description={description}
              note={id === reasoning.defaultEffort && "Default"}
            />
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
