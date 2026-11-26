![VoidCode banner](.github/assets/voidcode-banner.png)

<div align="center">
  <img src=".github/assets/voidcode-logo.png" alt="VoidCode logo" width="120">
  <h1>VoidCode</h1>
  <p><strong>A local-first AI coding environment.</strong> One desktop app, one embedded CLI, no runtime to install.</p>
  <p>
    <img alt="Windows" src="https://img.shields.io/badge/Windows-x64-0078D6?style=flat-square&logo=windows">
    <img alt="License" src="https://img.shields.io/badge/license-MIT-8c7cff?style=flat-square">
    <img alt="Version" src="https://img.shields.io/badge/version-2.0.0-8c7cff?style=flat-square">
  </p>
</div>

VoidCode is a focused rebuild of the OpenCode desktop experience: a dark, distraction-free workspace for talking to AI about code, inspecting changes, and keeping everything on your machine. The Windows installer ships with the CLI/server compiled into a standalone executable, so a clean PC can run it with a double-click.

## Highlights

- **Tauri v2 + Rust shell** — native desktop wrapper instead of Electron, with a much smaller Windows installer (~150 MB).
- **Self-contained Windows build** — no Bun, Node.js, dev server, or batch files required.
- **Embedded CLI** — `opencode-cli.exe` is auto-started invisibly from app resources on a free loopback port and stopped when VoidCode exits.
- **Liquid Glass** — saturation, inset highlights, volume shadows, wallpaper-aware blur, and native window translucency.
- **Wallpapers** — Pure AMOLED, Obsidian Singularity, Cyber Mesh Grid, or your own image with dimming and blur.
- **VoidCode Studio** — live theme preview, OpenCode JSON theme import/export, instant custom CSS with a kill switch, and shortcut editing.
- **Local-first controls** — Privacy Shield blocks frontend network boundaries; auto-wipe clears local app records.
- **Two languages** — complete English and Russian interfaces with no mixed labels.
- **Clear onboarding** — a short welcome screen instead of a wall of setup steps.

## Screenshots

Captured from the packaged Windows build.

![VoidCode desktop](.github/assets/voidcode-app-real.png)

![VoidCode terminal](.github/assets/voidcode-terminal.png)

## Download

Grab the v2.0.0 installer from the [GitHub release](https://github.com/Dirfiks3/voidcode/releases/tag/v2.0.0):

| Platform | File |
| --- | --- |
| Windows x64 | `opencode-desktop-win-x64.exe` |

Run it, then launch **VoidCode** from the Start menu. The background service starts automatically.

## What is inside

- Tauri v2 + Rust native desktop shell
- SolidJS renderer (VoidCode UI)
- Standalone Bun-compiled Windows CLI, version `2.4.1`
- Local loopback sidecar bridge bound to `127.0.0.1`
- Native window vibrancy, dialogs, clipboard, notifications, and PTY integrations

The app never asks you to pre-start a server on port `4096`. That path is development-only.

## Development

```bash
bun install
bun run dev:live
```

Useful checks:

```bash
bun run typecheck        # in packages/app, packages/ui, or packages/desktop
bun run typecheck:tsc
bun test src             # in packages/desktop
```

Build the standalone CLI, frontend, and Tauri NSIS installer:

```bash
cd packages/cli
OPENCODE_TARGET=windows-x64-baseline OPENCODE_CHANNEL=latest OPENCODE_VERSION=2.4.1 \
  bun run script/build.ts --skip-install

# copy CLI to Tauri sidecar location (target-triple name)
cp dist/cli-windows-x64-baseline/bin/opencode.exe \
  ../desktop-tauri/src-tauri/binaries/opencode-cli-x86_64-pc-windows-msvc.exe

cd ../app
VITE_OPENCODE_SERVER_MODE=none bun run build

cd ../desktop-tauri
bun run script/copy-frontend.mjs
cd src-tauri
cargo tauri build --bundles nsis
```

## Credits

VoidCode is built on the open-source [OpenCode](https://github.com/anomalyco/opencode) codebase. OpenCode remains a trademark of its respective owners. VoidCode is an independent local customization and is not affiliated with or endorsed by the OpenCode project.

## License

MIT. See [LICENSE](LICENSE).
