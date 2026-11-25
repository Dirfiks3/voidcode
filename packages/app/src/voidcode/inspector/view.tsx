import { For, Show, createMemo, createSignal, type Accessor } from "solid-js"
import { createStore } from "solid-js/store"
import type { SessionMessageInfo } from "@opencode/client/promise"
import { Icon } from "@opencode/ui/icon"
import { TextInput } from "@opencode/ui/text-input"
import { writeClipboard } from "@opencode/session-ui/copy"
import { useLanguage } from "@/runtime/i18n/language"
import { sessionTodos } from "@/session/composer/todos"
import { showToast } from "@/shell/notifications/toast"
import {
  buildFileTree,
  filterTree,
  flattenTree,
  parseAgentSteps,
  parseArtifacts,
  parseDiffs,
  type AgentStep,
  type Artifact,
} from "./model"
import "./inspector.css"

export type InspectorViewProps = {
  messages: Accessor<SessionMessageInfo[]>
  files: Accessor<string[]>
  readFile: (path: string) => Promise<string | undefined>
  openFile: (path: string) => void
}

function downloadText(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function InspectorActions(props: { artifact: Artifact; openFile?: () => void }) {
  const language = useLanguage()
  const copy = async () => {
    const copied = await writeClipboard(props.artifact.content)
    showToast({
      variant: copied ? "success" : "error",
      title: language.t(copied ? "voidcode.inspector.copied" : "voidcode.inspector.copy"),
    })
  }

  return (
    <div class="voidcode-inspector__actions">
      <button type="button" class="voidcode-inspector__action" onClick={() => void copy()}>
        <Icon name="copy" />
        {language.t("voidcode.inspector.copy")}
      </button>
      <Show when={props.artifact.path && props.openFile}>
        <button type="button" class="voidcode-inspector__action" onClick={() => props.openFile?.()}>
          <Icon name="filetree" />
          {language.t("voidcode.inspector.open")}
        </button>
      </Show>
      <button
        type="button"
        class="voidcode-inspector__action"
        onClick={() => downloadText(props.artifact.path?.split("/").pop() ?? "artifact.txt", props.artifact.content)}
      >
        <Icon name="download" />
        {language.t("voidcode.inspector.export")}
      </button>
    </div>
  )
}

export function ArtifactsView(props: InspectorViewProps) {
  const language = useLanguage()
  const artifacts = createMemo(() => parseArtifacts(props.messages()))

  return (
    <Show when={artifacts().length > 0} fallback={<p>{language.t("voidcode.inspector.empty.artifacts")}</p>}>
      <For each={artifacts()}>
        {(artifact) => (
          <article class="voidcode-inspector__card">
            <div class="flex items-center justify-between gap-2">
              <span class="min-w-0 truncate font-medium text-v2-text-text-base">{artifact.title}</span>
              <span class="voidcode-inspector__badge">{language.t(`voidcode.inspector.kind.${artifact.kind}`)}</span>
            </div>
            <Show when={artifact.path}>
              {(path) => <div class="truncate text-[12px] text-v2-text-text-faint">{path()}</div>}
            </Show>
            <pre class="voidcode-inspector__preview">{artifact.content.slice(0, 2000)}</pre>
            <InspectorActions artifact={artifact} openFile={artifact.path ? () => props.openFile(artifact.path!) : undefined} />
          </article>
        )}
      </For>
    </Show>
  )
}

function AgentStepCapsule(props: { step: AgentStep }) {
  const language = useLanguage()
  const [open, setOpen] = createSignal(false)
  const icon = () =>
    props.step.kind === "read" ? "eye" : props.step.kind === "shell" ? "terminal" : props.step.kind === "edit" ? "code" : "comment"

  return (
    <div class="voidcode-agent-capsule" data-status={props.step.status}>
      <button
        type="button"
        class="voidcode-inspector__row w-full"
        aria-expanded={open()}
        onClick={() => setOpen(!open())}
      >
        <span class="voidcode-agent-capsule__icon"><Icon name={icon()} /></span>
        <span class="voidcode-agent-capsule__dot" aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate text-start text-[13px] leading-[var(--line-height-base)]">
          {language.t(`voidcode.inspector.step.${props.step.kind}`)}
        </span>
        <span class="voidcode-inspector__badge">{props.step.detail.slice(0, 40)}</span>
      </button>
      <div class="voidcode-agent-capsule__log" data-open={open() ? "true" : undefined}>
        <div><pre class="voidcode-inspector__preview">{props.step.detail}</pre></div>
      </div>
    </div>
  )
}

export function PlanView(props: InspectorViewProps) {
  const language = useLanguage()
  const todos = createMemo(() => sessionTodos(props.messages()))
  const steps = createMemo(() => parseAgentSteps(props.messages()))
  const done = createMemo(() => todos().filter((todo) => todo.status === "completed" || todo.status === "cancelled").length)
  const [expanded, setExpanded] = createSignal<number>()

  return (
    <Show when={todos().length > 0 || steps().length > 0} fallback={<p>{language.t("voidcode.inspector.empty.plan")}</p>}>
      <Show when={todos().length > 0}>
      <div class="voidcode-inspector__card">
        <div class="mb-3 flex items-center justify-between gap-2 text-[13px] leading-[var(--line-height-base)] text-v2-text-text-muted">
          <span>{language.t("voidcode.inspector.progress", { done: done(), total: todos().length })}</span>
          <span>{Math.round((done() / Math.max(1, todos().length)) * 100)}%</span>
        </div>
        <div class="voidcode-inspector__progress">
          <span style={{ width: `${Math.round((done() / Math.max(1, todos().length)) * 100)}%` }} />
        </div>
      </div>
      <For each={todos()}>
        {(todo, index) => {
          const statusKey =
            todo.status === "completed" ? "done" : todo.status === "in_progress" ? "active" : "pending"
          return (
            <div class="voidcode-inspector__card">
              <button
                type="button"
                class="voidcode-inspector__row w-full"
                aria-expanded={expanded() === index()}
                onClick={() => setExpanded(expanded() === index() ? undefined : index())}
              >
                <span
                  class="voidcode-status-orb"
                  data-status={todo.status === "in_progress" ? "running" : todo.status === "completed" ? "idle" : "error"}
                />
                <span class="min-w-0 flex-1 text-start text-[13px] leading-[var(--line-height-compact)] text-v2-text-text-base">
                  {todo.content}
                </span>
                <span class="voidcode-inspector__badge">{language.t(`voidcode.inspector.status.${statusKey}`)}</span>
              </button>
              <Show when={expanded() === index()}>
                <p class="mt-2 text-[12px] text-v2-text-text-faint">{todo.content}</p>
              </Show>
            </div>
          )
        }}
      </For>
      </Show>
      <Show when={steps().length > 0}>
        <div class="mt-3 flex flex-col gap-2">
          <For each={steps()}>{(step) => <AgentStepCapsule step={step} />}</For>
        </div>
      </Show>
    </Show>
  )
}

export function DiffsView(props: InspectorViewProps) {
  const language = useLanguage()
  const diffs = createMemo(() => parseDiffs(props.messages()))
  const [open, setOpen] = createStore<Record<string, boolean>>({})

  return (
    <Show when={diffs().length > 0} fallback={<p>{language.t("voidcode.inspector.empty.diffs")}</p>}>
      <For each={diffs()}>
        {(diff) => (
          <article class="voidcode-inspector__card">
            <div class="flex min-w-0 items-center justify-between gap-2">
              <button
                type="button"
                class="min-w-0 truncate text-start font-medium text-v2-text-text-base"
                onClick={() => setOpen(diff.path, !open[diff.path])}
              >
                {diff.path.split("/").pop() ?? diff.path}
              </button>
              <span class="flex shrink-0 items-center gap-1 font-mono text-[12px] leading-[var(--line-height-base)]">
                <span class="voidcode-inspector__badge" data-tone="add">+{diff.additions}</span>
                <span class="voidcode-inspector__badge" data-tone="remove">−{diff.deletions}</span>
              </span>
            </div>
            <div class="truncate text-[12px] text-v2-text-text-faint">{diff.path}</div>
            <button type="button" class="voidcode-inspector__action mt-2" onClick={() => setOpen(diff.path, !open[diff.path])}>
              <Icon name="chevron-down" />
              {language.t(open[diff.path] ? "voidcode.inspector.hideDiff" : "voidcode.inspector.showDiff")}
            </button>
            <Show when={open[diff.path]}>
              <pre class="voidcode-inspector__preview">
                <For each={diff.patch.split("\n")}>
                  {(line) => (
                    <div
                      classList={{
                        "voidcode-inspector__diff-add": line.startsWith("+"),
                        "voidcode-inspector__diff-remove": line.startsWith("-"),
                      }}
                    >
                      {line}
                    </div>
                  )}
                </For>
              </pre>
              <button type="button" class="voidcode-inspector__action" onClick={() => props.openFile(diff.path)}>
                <Icon name="filetree" />
                {language.t("voidcode.inspector.open")}
              </button>
            </Show>
          </article>
        )}
      </For>
    </Show>
  )
}

export function FilesView(props: InspectorViewProps) {
  const language = useLanguage()
  const [query, setQuery] = createSignal("")
  const [preview, setPreview] = createSignal<{ path: string; content: string }>()
  const tree = createMemo(() => filterTree(buildFileTree(props.files()), query()))
  const count = createMemo(() => flattenTree(props.files().length ? buildFileTree(props.files()) : []).filter((node) => !node.directory).length)

  const select = async (path: string) => {
    const content = await props.readFile(path)
    if (content !== undefined) setPreview({ path, content })
  }

  return (
    <>
      <TextInput
        value={query()}
        placeholder={language.t("voidcode.inspector.search")}
        aria-label={language.t("voidcode.inspector.search")}
        onInput={(event) => setQuery(event.currentTarget.value)}
      />
      <p class="my-2 text-[12px] text-v2-text-text-faint">
        {language.t("voidcode.inspector.files.count", { count: count() })}
      </p>
      <Show when={tree().length > 0} fallback={<p>{language.t("voidcode.inspector.empty.files")}</p>}>
        <For each={tree()}>
          {(node) => (
            <FileRow node={node} depth={0} onSelect={select} />
          )}
        </For>
      </Show>
      <Show when={preview()}>
        {(value) => (
          <article class="voidcode-inspector__card mt-3">
            <div class="mb-2 flex items-center justify-between gap-2">
              <span class="min-w-0 truncate font-medium">{value().path}</span>
              <button
                type="button"
                class="voidcode-inspector__action"
                onClick={() => props.openFile(value().path)}
              >
                <Icon name="filetree" />
                {language.t("voidcode.inspector.open")}
              </button>
            </div>
            <pre class="voidcode-inspector__preview">{value().content.slice(0, 4000)}</pre>
          </article>
        )}
      </Show>
    </>
  )
}

function FileRow(props: {
  node: ReturnType<typeof flattenTree>[number]
  depth: number
  onSelect: (path: string) => void
}) {
  return (
    <>
      <button
        type="button"
        class="voidcode-inspector__row w-full"
        style={{ "padding-inline-start": `${8 + props.depth * 16}px` }}
        onClick={() => !props.node.directory && void props.onSelect(props.node.path)}
      >
        <Icon name={props.node.directory ? "folder" : "file"} />
        <span class="min-w-0 flex-1 truncate text-start text-[13px] leading-[var(--line-height-compact)]">
          {props.node.name}
        </span>
      </button>
      <For each={props.node.children}>{(child) => <FileRow node={child} depth={props.depth + 1} onSelect={props.onSelect} />}</For>
    </>
  )
}
