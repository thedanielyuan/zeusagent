import type { ChatModel, ModelReasoning, ReasoningEffort } from "./types";

/**
 * Models offered in the picker. The ids are OpenRouter model slugs and `reasoning` mirrors each
 * model's `reasoning` entry, so this list can later be replaced by (or filtered from)
 * https://openrouter.ai/api/v1/models without other changes.
 */
export const MODELS: ChatModel[] = [
  {
    id: "openai/gpt-6.1-sol",
    name: "GPT-6.1 Sol",
    provider: "OpenAI",
    description: "Strong all-rounder for coding and work",
    reasoning: { efforts: ["low", "medium", "high", "xhigh", "max"], defaultEffort: "medium" },
  },
  {
    id: "openai/gpt-6-luna",
    name: "GPT-6 Luna",
    provider: "OpenAI",
    description: "Fast and cost-efficient for everyday chat",
    reasoning: {
      efforts: ["none", "low", "medium", "high", "xhigh", "max"],
      defaultEffort: "medium",
    },
  },
  {
    id: "anthropic/claude-opus-5.5",
    name: "Claude Opus 5.5",
    provider: "Anthropic",
    description: "Flagship for demanding reasoning and coding",
    reasoning: { efforts: ["low", "medium", "high", "xhigh", "max"], defaultEffort: "high" },
  },
  {
    id: "anthropic/claude-sonnet-5.5",
    name: "Claude Sonnet 5.5",
    provider: "Anthropic",
    description: "Great everyday model for writing and code",
    reasoning: { efforts: ["low", "medium", "high", "xhigh", "max"], defaultEffort: "high" },
  },
  {
    id: "google/gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "Google",
    description: "Quick, capable multi-step reasoning",
    reasoning: { efforts: ["low", "medium", "high"], defaultEffort: "medium" },
  },
  {
    id: "x-ai/grok-4.7",
    name: "Grok 4.7",
    provider: "SpaceXAI",
    description: "Built for coding, agents and knowledge work",
    reasoning: { efforts: ["low", "medium", "high", "xhigh"], defaultEffort: "high" },
  },
  {
    id: "deepseek/deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    provider: "DeepSeek",
    description: "Efficient mixture-of-experts model",
    reasoning: { efforts: ["low", "high", "max"], defaultEffort: "high" },
  },
  {
    id: "moonshotai/kimi-k3",
    name: "Kimi K3",
    provider: "Moonshot AI",
    description: "Open-weight model for coding and long tasks",
    reasoning: { efforts: ["low", "high", "max"], defaultEffort: "max" },
  },
];

export const DEFAULT_MODEL_ID = MODELS[0].id;

export function getModel(id: string | undefined): ChatModel | undefined {
  return MODELS.find((model) => model.id === id);
}

/** Display name for a model id, falling back to the slug for models no longer listed. */
export function modelName(id: string): string {
  return getModel(id)?.name ?? id.split("/").pop() ?? id;
}

/** Every reasoning effort, lowest first. */
export const EFFORTS: { id: ReasoningEffort; name: string; description: string }[] = [
  { id: "none", name: "None", description: "Replies right away, without reasoning" },
  { id: "minimal", name: "Minimal", description: "Barely reasons before replying" },
  { id: "low", name: "Low", description: "Light reasoning for quick answers" },
  { id: "medium", name: "Medium", description: "Balances speed and depth" },
  { id: "high", name: "High", description: "Thinks longer about hard problems" },
  { id: "xhigh", name: "Extra high", description: "Extended reasoning for complex work" },
  { id: "max", name: "Max", description: "Reasons as long as it needs, slowest" },
];

export function isEffort(value: unknown): value is ReasoningEffort {
  return EFFORTS.some((effort) => effort.id === value);
}

export function effortName(effort: ReasoningEffort): string {
  return EFFORTS.find(({ id }) => id === effort)?.name ?? effort;
}

const effortRank = (effort: ReasoningEffort) => EFFORTS.findIndex(({ id }) => id === effort);

/**
 * The effort a model runs at when the user prefers `preferred` (null: the model's default).
 * A model without that level gets the closest one it has, rounding up between two equally close.
 */
export function resolveEffort(
  { efforts, defaultEffort }: ModelReasoning,
  preferred: ReasoningEffort | null,
): ReasoningEffort {
  if (!preferred) return defaultEffort;

  const distance = (effort: ReasoningEffort) => Math.abs(effortRank(effort) - effortRank(preferred));
  return [...efforts].sort((a, b) => distance(a) - distance(b) || effortRank(b) - effortRank(a))[0];
}
