import type { SessionMessageInfo } from "@opencode/client/promise"

export type ArtifactKind = "code" | "file" | "report" | "svg" | "html"

export type Artifact = {
  id: string
  title: string
  path?: string
  kind: ArtifactKind
  language: string
  content: string
}

export type FileDiff = {
  path: string
  additions: number
  deletions: number
  patch: string
  tool: string
}

export type FileNode = {
  path: string
  name: string
  directory: boolean
  children: FileNode[]
}

export type AgentStep = {
  id: string
  kind: "read" | "shell" | "edit" | "thought"
  status: "running" | "completed" | "error"
  detail: string
}

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined

const text = (value: unknown) => (typeof value === "string" ? value : undefined)

function field(input: Record<string, unknown>, ...names: string[]) {
  for (const name of names) {
    const value = text(input[name])
    if (value !== undefined) return value
  }
  return undefined
}

type ToolPart = {
  name: string
  input: Record<string, unknown>
  metadata: Record<string, unknown>
  files: FileDiffInfo[]
}

export type FileDiffInfo = {
  file: string
  patch: string
  additions: number
  deletions: number
  status: "added" | "deleted" | "modified"
}

const fileDiffInfo = (value: unknown): FileDiffInfo | undefined => {
  const entry = record(value)
  if (!entry || typeof entry.file !== "string" || typeof entry.patch !== "string") return undefined
  const status = entry.status
  return {
    file: entry.file,
    patch: entry.patch,
    additions: typeof entry.additions === "number" ? entry.additions : 0,
    deletions: typeof entry.deletions === "number" ? entry.deletions : 0,
    status: status === "added" || status === "deleted" || status === "modified" ? status : "modified",
  }
}

function toolParts(messages: readonly SessionMessageInfo[]): ToolPart[] {
  return messages.flatMap((message) =>
    message.type === "assistant"
      ? message.content.flatMap((part) => {
          if (part.type !== "tool" || (part.state.status !== "completed" && part.state.status !== "error")) return []
          const input = record(part.state.input) ?? {}
          const metadata = record(part.state.metadata) ?? {}
          const files = Array.isArray(metadata.files) ? metadata.files.flatMap((file) => fileDiffInfo(file) ?? []) : []
          return [{ name: part.name, input, metadata, files }]
        })
      : [],
  )
}

const FILE_TOOLS = new Set(["write", "edit", "patch", "apply_patch"])

const CODE_FENCE = /```([\w-]*)\n([\s\S]*?)```/g

function kindFor(language: string, content: string): ArtifactKind {
  const hint = language.toLowerCase()
  if (hint === "svg" || content.trimStart().startsWith("<svg")) return "svg"
  if (hint === "html" || hint === "xml" || content.trimStart().startsWith("<!doctype html")) return "html"
  if (hint === "md" || hint === "markdown") return "report"
  return "code"
}

/** Code and document blocks the agent produced, plus files it wrote during the session. */
export function parseArtifacts(messages: readonly SessionMessageInfo[]): Artifact[] {
  const artifacts: Artifact[] = []
  const seen = new Set<string>()

  const add = (artifact: Artifact) => {
    if (!artifact.content.trim() || seen.has(artifact.id)) return
    seen.add(artifact.id)
    artifacts.push(artifact)
  }

  for (const message of messages) {
    if (message.type !== "assistant") continue
    for (const part of message.content) {
      if (part.type !== "text") continue
      for (const match of part.text.matchAll(CODE_FENCE)) {
        const language = match[1] ?? ""
        const content = match[2] ?? ""
        add({
          id: `block:${message.id}:${match.index ?? 0}`,
          title: language || kindFor(language, content),
          language,
          kind: kindFor(language, content),
          content,
        })
      }
    }
  }

  for (const part of toolParts(messages)) {
    if (!FILE_TOOLS.has(part.name)) continue
    const path = field(part.input, "path", "filePath", "file_path")
    const content = field(part.input, "content", "newString", "new_string", "patchText", "patch", "string")
    if (!path || !content) continue
    const language = path.split(".").pop() ?? ""
    add({
      id: `file:${path}`,
      title: path.split("/").pop() ?? path,
      path,
      language,
      kind: kindFor(language, content),
      content,
    })
  }

  return artifacts.slice(-40).reverse()
}

function countChange(before: string, after: string) {
  const oldLines = before ? before.replace(/\n$/, "").split("\n") : []
  const nextLines = after ? after.replace(/\n$/, "").split("\n") : []
  // A line-diff that keeps the unchanged head and tail is enough for a session badge; the full unified patch is
  // kept only for the preview, so no dependency on a diff library is needed here.
  let start = 0
  while (start < oldLines.length && start < nextLines.length && oldLines[start] === nextLines[start]) start += 1
  let end = 0
  while (
    end < oldLines.length - start &&
    end < nextLines.length - start &&
    oldLines[oldLines.length - 1 - end] === nextLines[nextLines.length - 1 - end]
  )
    end += 1

  const removed = oldLines.slice(start, oldLines.length - end)
  const added = nextLines.slice(start, nextLines.length - end)
  const patch = [
    `@@ -${start + 1},${removed.length} +${start + 1},${added.length} @@`,
    ...removed.map((line) => `-${line}`),
    ...added.map((line) => `+${line}`),
  ].join("\n")

  return { additions: added.length, deletions: removed.length, patch }
}

/** Files touched by edit/write tools, with running line counts and a compact patch for the preview. */
export function parseDiffs(messages: readonly SessionMessageInfo[]): FileDiff[] {
  const byPath = new Map<string, FileDiff>()

  const recordFile = (path: string, additions: number, deletions: number, patch: string, tool: string) => {
    const previous = byPath.get(path)
    byPath.set(path, {
      path,
      additions: (previous?.additions ?? 0) + additions,
      deletions: (previous?.deletions ?? 0) + deletions,
      patch: patch || (previous?.patch ?? ""),
      tool,
    })
  }

  for (const part of toolParts(messages)) {
    if (!FILE_TOOLS.has(part.name)) continue

    // The core tool reports exact counts in `metadata.files`; use them when available.
    const reported = part.files.length > 0
    for (const file of part.files)
      recordFile(file.file, file.additions, file.deletions, file.patch, part.name)

    if (reported) continue

    const path = field(part.input, "path", "filePath", "file_path")
    if (!path) continue
    const next = field(part.input, "content", "newString", "new_string", "patchText", "patch", "string") ?? ""
    const before = field(part.input, "oldString", "old_string") ?? ""
    const change = part.name === "edit" ? countChange(before, next) : countChange("", next)
    recordFile(path, change.additions, change.deletions, change.patch, part.name)
  }

  return [...byPath.values()].reverse()
}

/** Recent agent actions as walkthrough capsules: reads, shells, edits and reasoning. */
export function parseAgentSteps(messages: readonly SessionMessageInfo[]): AgentStep[] {
  const steps: AgentStep[] = []

  for (const message of messages) {
    if (message.type !== "assistant") continue
    for (const part of message.content) {
      if (part.type === "reasoning") {
        const detail = part.text.trim()
        if (!detail) continue
        steps.push({
          id: `${message.id}:thought:${steps.length}`,
          kind: "thought",
          status: "completed",
          detail: detail.slice(0, 160),
        })
        continue
      }
      if (part.type !== "tool") continue
      const kind =
        part.name === "read"
          ? "read"
          : part.name === "bash" || part.name === "shell"
            ? "shell"
            : FILE_TOOLS.has(part.name)
              ? "edit"
              : undefined
      if (!kind) continue
      const input = record(part.state.input) ?? {}
      const detail =
        (kind === "shell"
          ? field(input, "command")
          : field(input, "path", "filePath", "file_path") ?? field(input, "patchText", "patch")) ?? ""
      steps.push({
        id: `${message.id}:${part.id}`,
        kind,
        status: part.state.status === "error" ? "error" : part.state.status === "running" ? "running" : "completed",
        detail: part.state.status === "error" ? part.state.error.message : detail,
      })
    }
  }

  return steps.slice(-12).reverse()
}

/** A nested tree built from the flat file paths the workspace reports. */
export function buildFileTree(paths: readonly string[]): FileNode[] {
  const root: FileNode[] = []
  const directories = new Map<string, FileNode>()

  for (const path of [...paths].sort()) {
    const segments = path.replace(/^\.\//, "").split("/").filter(Boolean)
    if (!segments.length) continue
    let level = root
    let prefix = ""
    segments.forEach((name, index) => {
      prefix = prefix ? `${prefix}/${name}` : name
      const directory = index < segments.length - 1
      const key = `${directory ? "d" : "f"}:${prefix}`
      let node = directories.get(key)
      if (!node) {
        node = { path: prefix, name, directory, children: [] }
        directories.set(key, node)
        level.push(node)
      }
      level = node.children
    })
  }

  const sort = (nodes: FileNode[]) => {
    nodes.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name))
    nodes.forEach((node) => sort(node.children))
  }
  sort(root)
  return root
}

export function flattenTree(nodes: readonly FileNode[]): FileNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)])
}

export function filterTree(nodes: readonly FileNode[], query: string): FileNode[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [...nodes]
  return nodes.flatMap((node) => {
    const children = filterTree(node.children, needle)
    if (node.name.toLowerCase().includes(needle) || (!node.directory && children.length)) return [{ ...node, children }]
    return children
  })
}
