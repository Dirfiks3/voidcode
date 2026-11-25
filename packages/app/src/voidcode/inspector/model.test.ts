import { describe, expect, test } from "bun:test"
import type { SessionMessageInfo } from "@opencode/client/promise"
import { buildFileTree, filterTree, flattenTree, parseAgentSteps, parseArtifacts, parseDiffs } from "./model"

const message = (parts: unknown[]): SessionMessageInfo =>
  ({ id: "msg1", type: "assistant", content: parts }) as unknown as SessionMessageInfo

const tool = (name: string, input: unknown, metadata?: unknown) => ({
  type: "tool",
  id: `tool-${name}`,
  name,
  state: { status: "completed", input, metadata: metadata ?? {}, content: [{ type: "text", text: "ok" }] },
})

describe("parseArtifacts", () => {
  test("collects fenced code blocks and written files without duplicates", () => {
    const messages = [
      message([
        { type: "text", text: "Here is the module:\n```ts\nexport const answer = 42\n```" },
        tool("write", { path: "src/app.ts", content: "export const app = true\n" }),
        tool("write", { path: "src/app.ts", content: "export const app = true\n" }),
      ]),
    ]

    const artifacts = parseArtifacts(messages)

    expect(artifacts.length).toBe(2)
    expect(artifacts.some((item) => item.kind === "code" && item.content.includes("answer = 42"))).toBe(true)
    expect(artifacts.some((item) => item.path === "src/app.ts" && item.title === "app.ts")).toBe(true)
  })

  test("labels svg and markdown blocks by their content", () => {
    const artifacts = parseArtifacts([
      message([
        { type: "text", text: "```svg\n<svg viewBox=\"0 0 1 1\"></svg>\n```\n```md\n# Report\n```" },
      ]),
    ])

    expect(artifacts.map((item) => item.kind)).toEqual(["report", "svg"])
  })
})

describe("parseDiffs", () => {
  test("prefers reported file counts from tool metadata", () => {
    const diffs = parseDiffs([
      message([
        tool(
          "edit",
          { path: "src/a.ts", oldString: "old", newString: "new" },
          { files: [{ file: "src/a.ts", patch: "@@ -1 +1 @@\n-old\n+new", additions: 12, deletions: 3, status: "modified" }] },
        ),
      ]),
    ])

    expect(diffs).toEqual([
      { path: "src/a.ts", additions: 12, deletions: 3, patch: "@@ -1 +1 @@\n-old\n+new", tool: "edit" },
    ])
  })

  test("computes and accumulates changes from tool input when metadata is absent", () => {
    const diffs = parseDiffs([
      message([
        tool("write", { path: "src/b.ts", content: "one\ntwo\n" }),
        tool("edit", { path: "src/b.ts", oldString: "one", newString: "ONE" }),
      ]),
    ])

    expect(diffs.length).toBe(1)
    expect(diffs[0]!.path).toBe("src/b.ts")
    expect(diffs[0]!.additions).toBe(3)
    expect(diffs[0]!.deletions).toBe(1)
    expect(diffs[0]!.patch).toContain("-one")
    expect(diffs[0]!.patch).toContain("+ONE")
  })
})

describe("parseAgentSteps", () => {
  test("maps tool and reasoning parts into status-tinted capsules", () => {
    const steps = parseAgentSteps([
      message([
        { type: "reasoning", text: "Checking the module first" },
        tool("read", { path: "src/app.ts" }),
        { type: "tool", id: "t2", name: "bash", state: { status: "error", input: { command: "npm test" }, error: { type: "shell", message: "failed" } } },
      ]),
    ])

    expect(steps.map((step) => step.kind)).toEqual(["shell", "read", "thought"])
    expect(steps[0]!.status).toBe("error")
    expect(steps[0]!.detail).toBe("failed")
  })
})

describe("file tree", () => {
  test("nests paths, keeps directories first, and filters by name", () => {
    const tree = buildFileTree(["src/b.ts", "src/nested/a.ts", "README.md"])

    expect(tree.map((node) => node.name)).toEqual(["src", "README.md"])
    expect(tree[0]!.children.map((node) => node.name)).toEqual(["nested", "b.ts"])
    expect(flattenTree(tree).length).toBe(5)
    expect(filterTree(tree, "readme").map((node) => node.name)).toEqual(["README.md"])
  })
})
