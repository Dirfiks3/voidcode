type Rule = { pattern: RegExp; icon: string }

// Ordered: the first match wins. Every rule is deliberately case-insensitive and matches a substring so provider
// aliases, version suffixes and Console-prefixed IDs resolve to the same locally bundled SVG.
const RULES: readonly Rule[] = [
  { pattern: /nvidia|nemotron/i, icon: "nvidia" },
  { pattern: /minimax/i, icon: "minimax" },
  { pattern: /grok|xai/i, icon: "grok" },
  { pattern: /gemini|google/i, icon: "gemini" },
  { pattern: /qwen|tongyi/i, icon: "qwen" },
  { pattern: /deepseek/i, icon: "deepseek" },
  { pattern: /kimi|moonshot/i, icon: "kimi" },
  { pattern: /glm|zhipu|chatglm/i, icon: "zhipu" },
  { pattern: /mistral/i, icon: "mistral" },
  { pattern: /ollama/i, icon: "ollama" },
  { pattern: /llama|meta/i, icon: "meta" },
  { pattern: /claude|anthropic/i, icon: "claude" },
  { pattern: /gpt|chatgpt|openai|\bo[13]\b/i, icon: "openai" },
  { pattern: /openrouter/i, icon: "openrouter" },
  { pattern: /doubao|douyin/i, icon: "doubao" },
  { pattern: /volcengine/i, icon: "volcengine" },
  { pattern: /zenmux|zencoder/i, icon: "zenmux" },
  { pattern: /glmv/i, icon: "glmv" },
  { pattern: /llamaindex/i, icon: "llamaindex" },
  { pattern: /metai|metaai|metagpt/i, icon: "metaai" },
  { pattern: /claudecode/i, icon: "claudecode" },
  { pattern: /geminicli/i, icon: "geminicli" },
]

export function resolveModelIcon(providerID: string, modelID: string) {
  return RULES.find((rule) => rule.pattern.test(`${providerID} ${modelID}`))?.icon
}

export function modelMonogram(providerID: string, modelID: string) {
  const value = providerID.replace(/^console-/, "") || modelID
  return (value[0] ?? "?").toUpperCase()
}
