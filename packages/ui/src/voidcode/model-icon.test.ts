import { expect, test } from "bun:test"
import { resolveModelIcon } from "./model-icon"

const cases = [
  ["opencode", "big-pickle", undefined],
  ["console-minimax", "MiniMax-M2.1", "minimax"],
  ["xai", "grok-4", "grok"],
  ["google", "gemini-3-pro", "gemini"],
  ["qwen", "Qwen3-Coder", "qwen"],
  ["deepseek", "deepseek-chat", "deepseek"],
  ["moonshot", "kimi-k2", "kimi"],
  ["zhipu", "glm-4.6", "zhipu"],
  ["meta", "llama-3.3", "meta"],
  ["mistral", "mistral-large", "mistral"],
  ["nvidia", "nemotron-3", "nvidia"],
  ["anthropic", "claude-sonnet-4", "claude"],
  ["openai", "gpt-5", "openai"],
  ["openai", "o3", "openai"],
  ["openrouter", "openrouter/free", "openrouter"],
  ["ollama", "llama3", "ollama"],
  ["custom", "my-private-model", undefined],
] as const

test("model logos resolve case-insensitively from provider and model IDs", () => {
  for (const [providerID, modelID, expected] of cases) {
    expect(resolveModelIcon(providerID, modelID)).toBe(expected)
  }
})

test("every resolved logo is bundled locally for air-gap use", async () => {
  const icons = new Set(cases.flatMap((entry) => (entry[2] ? [entry[2]] : [])))
  const directory = new URL("../../../app/public/model-icons/", import.meta.url)

  for (const icon of icons) {
    expect(await Bun.file(new URL(`${icon}.svg`, directory)).exists()).toBe(true)
  }
})
