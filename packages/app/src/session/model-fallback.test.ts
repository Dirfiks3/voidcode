import { describe, expect, test } from "bun:test"
import { isLimitFailure, nextFallbackModel, type FallbackEntry } from "./model-fallback"

const entry = (providerID: string, modelID: string, enabled = true): FallbackEntry => ({
  providerID,
  modelID,
  enabled,
})

const chain = [entry("deepseek", "chat"), entry("minimax", "m3"), entry("opencode", "pickle")]

const all = () => true

describe("isLimitFailure", () => {
  test.each([
    ["provider.rate-limit", "", undefined],
    ["provider.quota", "", undefined],
    ["provider.budget-limit", "", undefined],
    ["provider.free-limit", "", undefined],
    ["provider.chatgpt-limit", "", undefined],
    ["provider.chatgpt-workspace-limit", "", undefined],
    ["provider.go-limit", "", undefined],
    ["provider.internal", "service overloaded", 503],
    ["provider.internal", "provider overloaded", 529],
    ["provider.unknown", "429 Too Many Requests", undefined],
    ["provider.unknown", "quota exceeded", undefined],
  ])("treats %s as a limit a fallback can get past", (type, message, status) => {
    expect(isLimitFailure({ type, message, status })).toBe(true)
  })

  test.each([
    ["provider.internal", "socket hang up", 500],
    ["provider.internal", "bad request", 400],
    ["provider.auth", "invalid api key", 401],
    ["provider.unknown", "model not found", 404],
    ["tool.error", "quota exceeded", undefined],
  ])("leaves %s alone", (type, message, status) => {
    expect(isLimitFailure({ type, message, status })).toBe(false)
  })
})

describe("nextFallbackModel", () => {
  test("takes the next enabled entry in configured order", () => {
    expect(
      nextFallbackModel({ current: chain[0], entries: chain, attempted: [], available: all }),
    ).toEqual({ providerID: "minimax", modelID: "m3" })
  })

  test("wraps to the start of the chain", () => {
    expect(
      nextFallbackModel({ current: chain[2], entries: chain, attempted: [], available: all }),
    ).toEqual({ providerID: "deepseek", modelID: "chat" })
  })

  test("skips models already refused in this turn", () => {
    expect(
      nextFallbackModel({
        current: chain[0],
        entries: chain,
        attempted: ["minimax/m3"],
        available: all,
      }),
    ).toEqual({ providerID: "opencode", modelID: "pickle" })
  })

  test("skips disabled models and models the client does not offer", () => {
    expect(
      nextFallbackModel({
        current: chain[0],
        entries: [entry("deepseek", "chat"), entry("minimax", "m3", false), chain[2]],
        attempted: [],
        available: (model) => model.modelID !== "pickle",
      }),
    ).toBeUndefined()
  })

  test("stays put when every model in the chain was already tried", () => {
    expect(
      nextFallbackModel({
        current: chain[0],
        entries: chain,
        attempted: ["deepseek/chat", "minimax/m3", "opencode/pickle"],
        available: all,
      }),
    ).toBeUndefined()
  })

  test("starts at the beginning when the current model is not in the chain", () => {
    expect(
      nextFallbackModel({
        current: { providerID: "other", modelID: "model" },
        entries: chain,
        attempted: [],
        available: all,
      }),
    ).toEqual({ providerID: "deepseek", modelID: "chat" })
  })

  test("never picks the current model", () => {
    expect(
      nextFallbackModel({
        current: chain[0],
        entries: [chain[0]],
        attempted: [],
        available: all,
      }),
    ).toBeUndefined()
  })
})
