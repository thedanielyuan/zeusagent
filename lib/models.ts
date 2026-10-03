import type { ChatModel } from "./types";

/**
 * Models offered in the picker. The ids are OpenRouter model slugs, so this list can later be
 * replaced by (or filtered from) https://openrouter.ai/api/v1/models without other changes.
 */
export const MODELS: ChatModel[] = [
  {
    id: "openai/gpt-6.1-sol",
    name: "GPT-6.1 Sol",
    provider: "OpenAI",
    description: "Strong all-rounder for coding and work",
  },
  {
    id: "openai/gpt-6-luna",
    name: "GPT-6 Luna",
    provider: "OpenAI",
    description: "Fast and cost-efficient for everyday chat",
  },
  {
    id: "anthropic/claude-opus-5.5",
    name: "Claude Opus 5.5",
    provider: "Anthropic",
    description: "Flagship for demanding reasoning and coding",
  },
  {
    id: "anthropic/claude-sonnet-5.5",
    name: "Claude Sonnet 5.5",
    provider: "Anthropic",
    description: "Great everyday model for writing and code",
  },
  {
    id: "google/gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "Google",
    description: "Quick, capable multi-step reasoning",
  },
  {
    id: "x-ai/grok-4.7",
    name: "Grok 4.7",
    provider: "SpaceXAI",
    description: "Built for coding, agents and knowledge work",
  },
  {
    id: "deepseek/deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    provider: "DeepSeek",
    description: "Efficient mixture-of-experts model",
  },
  {
    id: "moonshotai/kimi-k3",
    name: "Kimi K3",
    provider: "Moonshot AI",
    description: "Open-weight model for coding and long tasks",
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
