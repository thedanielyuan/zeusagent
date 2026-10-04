"use client";

import { Tooltip } from "@/components/ui/tooltip";
import type { Usage } from "@/lib/types";

const tokens = new Intl.NumberFormat("en-US");
const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumSignificantDigits: 2,
});

/** "$0.012", "$1.2", or "<$0.001" for the cheapest replies. */
function formatCost(cost: number): string {
  return cost > 0 && cost < 0.001 ? "<$0.001" : dollars.format(cost);
}

/** What a reply cost, with the tokens it used in a tooltip. */
export function ReplyCost({ usage }: { usage: Usage }) {
  const { inputTokens, cachedTokens, outputTokens, reasoningTokens, cost } = usage;
  const details = (
    <span className="flex flex-col gap-0.5 py-0.5">
      <span>
        {tokens.format(inputTokens)} tokens in
        {cachedTokens > 0 && `, ${tokens.format(cachedTokens)} from cache`}
      </span>
      <span>
        {tokens.format(outputTokens)} tokens out
        {reasoningTokens > 0 && `, ${tokens.format(reasoningTokens)} reasoning`}
      </span>
    </span>
  );

  return (
    <Tooltip content={details} side="top">
      {/* Focusable, so keyboard users can open the details too. */}
      <span tabIndex={0} className="shrink-0 rounded-sm">
        {formatCost(cost)}
      </span>
    </Tooltip>
  );
}
