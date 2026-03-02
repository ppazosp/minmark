# Pane — Design Document

Hypersimplified developer tool: terminal + WYSIWYG markdown editor + file tree sidebar.

## Decisions

- **IPC for `pane open` CLI:** Unix domain socket (`~/.pane.sock`)
- **Terminal:** Single shell per window (no tabs/splits)
- **Editor extensions:** GFM + task lists, footnotes, math (KaTeX), mermaid, syntax highlighting
- **Windowing:** Single window only

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Tauri Window                    │
│ ┌──────┐ ┌───────────────┐ ┌──────────────────┐ │
│ │ File │ │   Terminal    │ │     Editor       │ │
│ │ Tree │ │  (xterm.js)   │ │   (Milkdown)     │ │
│ │      │ │               │ │                  │ │
│ │ .md  │ │  PTY ↔ Rust   │ │  Tabs + WYSIWYG  │ │
│ │ only │ │  via events   │ │  auto-save 1s    │ │
│ └──────┘ └───────────────┘ └──────────────────┘ │
└─────────────────────────────────────────────────┘
         ↕ Tauri IPC (invoke + events)
┌─────────────────────────────────────────────────┐
│              Rust Backend                        │
│  portable-pty │ notify (fs watch) │ UDS listener │
└─────────────────────────────────────────────────┘
```

## Stack

- **Tauri v2** (Rust backend)
- **xterm.js** + WebGL addon (terminal)
- **portable-pty** (PTY management)
- **Milkdown** (WYSIWYG markdown editor)
- **Vanilla TypeScript + Vite** (frontend)
- **notify** crate (file watching)
- **tokio** (async runtime for UDS + PTY streaming)

## Rust Backend

### Tauri Commands

- `list_directory(path)` → tree of folders + .md files
- `read_file(path)` → file contents as string
- `write_file(path, content)` → writes markdown to disk
- `write_to_pty(data)` → sends bytes to shell stdin
- `resize_pty(cols, rows)` → resizes PTY

### Tauri Events (backend → frontend)

- `pty-output` — shell stdout/stderr chunks
- `fs-changed` — file tree changed (create/delete/rename)
- `open-file` — triggered by `pane open` CLI via UDS

### PTY

Spawn user's `$SHELL` on startup. Single PTY. Stream output via events. Accept input via command.

### File Watcher

`notify` crate watches working directory recursively. Filters to .md files + directory changes. Debounced.

### UDS Listener

On startup, bind `~/.pane.sock`. Listen for JSON messages like `{"cmd":"open","path":"/abs/path/to.md"}`. Emit `open-file` event to frontend. Clean up socket on exit.

## Frontend

### Layout

CSS Grid. Three columns: `[sidebar] [terminal] [editor]`. Drag handles between columns. Sidebar collapsible.

### File Tree (sidebar)

- Fetches tree via `list_directory` on startup
- Nested `<ul>` with folder expand/collapse
- Only .md files and folders containing .md files
- Click file → opens in editor
- Listens to `fs-changed` events for live updates

### Terminal Panel

- xterm.js + WebGL addon + fit addon
- Attach to PTY output events, send keystrokes via `write_to_pty`
- ResizeObserver → `resize_pty`
- Full color support

### Editor Panel

- Milkdown WYSIWYG editor
- Plugins: GFM, footnotes, math (KaTeX), mermaid, Prism syntax highlighting
- Tab bar: open files, unsaved dot indicator
- Auto-save: debounced 1s, calls `write_file`
- Markdown round-tripping: .md → ProseMirror → edit → serialize → .md

### Keyboard Shortcuts

- `Cmd+P` — quick file open (fuzzy search overlay)
- `Cmd+B` — toggle sidebar
- `Cmd+\` — toggle terminal/editor focus
- `Cmd+W` — close current editor tab

## `pane` CLI

Separate Rust binary. Connects to `~/.pane.sock`, sends JSON, exits.

```
pane open <file.md>   # resolves to absolute path, sends via UDS
```

## Project Structure

```
pane/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   ├── src/
│   │   ├── main.rs          # entry, setup PTY + watcher + UDS
│   │   ├── lib.rs           # Tauri command registration
│   │   ├── pty.rs           # PTY spawn, read, write, resize
│   │   ├── fs_ops.rs        # read_file, write_file, list_directory
│   │   ├── watcher.rs       # notify file watcher
│   │   └── socket.rs        # UDS listener for pane CLI
│   └── bin/
│       └── pane.rs          # CLI binary
├── src/
│   ├── index.html
│   ├── main.ts              # app init, layout, shortcuts
│   ├── terminal.ts          # xterm.js setup + PTY bridge
│   ├── editor.ts            # Milkdown setup + tab management
│   ├── filetree.ts          # sidebar file tree
│   ├── layout.ts            # resizable panels
│   ├── quickopen.ts         # Cmd+P fuzzy search
│   └── styles.css           # dark theme
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Styling

Dark theme. CSS variables. Monospace for terminal, system sans-serif for editor UI. Minimal borders — subtle background shifts to separate panels.
