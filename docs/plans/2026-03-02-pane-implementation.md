# Pane Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Tauri v2 desktop app with terminal, WYSIWYG markdown editor, and file tree sidebar.

**Architecture:** Three-panel Tauri v2 app. Rust backend manages PTY (portable-pty), filesystem ops (notify watcher), and UDS listener for CLI. Vanilla TS + Vite frontend with xterm.js terminal, Milkdown editor, and custom file tree.

**Tech Stack:** Tauri v2, portable-pty, notify, tokio, xterm.js, Milkdown, Vite, vanilla TypeScript

---

### Task 1: Scaffold Tauri v2 project

**Files:**
- Create: `pane/` project via `pnpm create tauri-app`
- Modify: `src-tauri/Cargo.toml` (add dependencies)
- Modify: `package.json` (add frontend dependencies)
- Modify: `src-tauri/tauri.conf.json` (configure window)
- Modify: `src-tauri/capabilities/default.json` (add permissions)

**Step 1:** Scaffold project with pnpm create tauri-app (vanilla TS template)

**Step 2:** Add Rust dependencies to Cargo.toml:
- portable-pty, notify, notify-debouncer-full, tokio, serde, serde_json, thiserror

**Step 3:** Add frontend dependencies:
- @xterm/xterm, @xterm/addon-webgl, @xterm/addon-fit
- @milkdown/kit, @milkdown/plugin-math, @milkdown/plugin-diagram, @milkdown/plugin-prism
- katex, mermaid, prismjs

**Step 4:** Configure tauri.conf.json: window title "Pane", no decorations menu, size 1200x800

**Step 5:** Configure capabilities: allow all custom commands

**Step 6:** Verify `pnpm tauri dev` compiles and shows empty window

**Step 7:** Commit

---

### Task 2: Rust backend — PTY management

**Files:**
- Create: `src-tauri/src/pty.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1:** Create pty.rs with:
- PtyState struct holding master writer + reader thread handle
- `spawn_pty(app_handle, cwd)` — spawns default shell, starts reader thread that emits "pty-output" events
- `write_to_pty(state, data)` Tauri command
- `resize_pty(state, cols, rows)` Tauri command

**Step 2:** Register PTY state and commands in lib.rs

**Step 3:** Verify compilation

**Step 4:** Commit

---

### Task 3: Rust backend — File system operations

**Files:**
- Create: `src-tauri/src/fs_ops.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1:** Create fs_ops.rs with:
- DirEntry serde struct (name, path, is_dir, children)
- `list_directory(path)` — recursive, filters .md files and folders containing .md files
- `read_file(path)` → String
- `write_file(path, content)` → ()

**Step 2:** Register commands in lib.rs

**Step 3:** Verify compilation

**Step 4:** Commit

---

### Task 4: Rust backend — File watcher

**Files:**
- Create: `src-tauri/src/watcher.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1:** Create watcher.rs with:
- `start_watcher(app_handle, path)` — uses notify-debouncer-full, 500ms debounce
- Filters to .md file changes and directory create/remove
- Emits "fs-changed" event to frontend with changed paths

**Step 2:** Start watcher in Tauri setup hook

**Step 3:** Verify compilation

**Step 4:** Commit

---

### Task 5: Rust backend — UDS socket listener

**Files:**
- Create: `src-tauri/src/socket.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1:** Create socket.rs with:
- `start_socket_listener(app_handle)` — binds ~/.pane.sock
- Listens for JSON messages {"cmd":"open","path":"..."}
- Emits "open-file" event to frontend
- Cleans up socket on drop

**Step 2:** Start socket listener in Tauri setup hook

**Step 3:** Verify compilation

**Step 4:** Commit

---

### Task 6: CLI binary — `pane open`

**Files:**
- Create: `src-tauri/src/bin/pane.rs`
- Modify: `src-tauri/Cargo.toml` (add [[bin]] section)

**Step 1:** Create pane.rs CLI:
- Parses `pane open <file>` args
- Resolves file to absolute path
- Connects to ~/.pane.sock
- Sends JSON {"cmd":"open","path":"<abs_path>"}
- Exits

**Step 2:** Add [[bin]] to Cargo.toml

**Step 3:** Verify `cargo build --bin pane` compiles

**Step 4:** Commit

---

### Task 7: Frontend — Dark theme + layout with resizable panels

**Files:**
- Modify: `src/index.html`
- Create: `src/styles.css`
- Create: `src/layout.ts`
- Create: `src/main.ts`

**Step 1:** Create styles.css: CSS variables for dark theme, three-column grid layout, drag handle styles

**Step 2:** Create index.html with three-panel structure: sidebar, terminal, editor

**Step 3:** Create layout.ts: ResizableLayout class with pointer event drag handles

**Step 4:** Create main.ts: initialize layout

**Step 5:** Verify renders in `pnpm tauri dev`

**Step 6:** Commit

---

### Task 8: Frontend — Terminal panel (xterm.js)

**Files:**
- Create: `src/terminal.ts`
- Modify: `src/main.ts`

**Step 1:** Create terminal.ts:
- initTerminal(container) — creates Terminal + FitAddon + WebglAddon
- Listens to "pty-output" events, writes to terminal
- terminal.onData → invoke write_to_pty
- ResizeObserver → invoke resize_pty
- fitAddon.fit() on container resize

**Step 2:** Wire up in main.ts

**Step 3:** Verify terminal works with live shell in `pnpm tauri dev`

**Step 4:** Commit

---

### Task 9: Frontend — File tree sidebar

**Files:**
- Create: `src/filetree.ts`
- Modify: `src/main.ts`

**Step 1:** Create filetree.ts:
- FileTree class
- fetchTree() → invoke list_directory
- renderTree() → nested ul/li with expand/collapse
- Click .md file → dispatch custom event "file-open"
- Listen to "fs-changed" Tauri events → re-fetch and re-render

**Step 2:** Wire up in main.ts

**Step 3:** Verify file tree shows .md files

**Step 4:** Commit

---

### Task 10: Frontend — Editor panel (Milkdown)

**Files:**
- Create: `src/editor.ts`
- Modify: `src/main.ts`

**Step 1:** Create editor.ts:
- EditorPanel class managing tab bar + Milkdown editor
- openFile(path) — invoke read_file, create/switch tab, load into Milkdown
- Tab bar rendering with unsaved indicator
- Milkdown setup: commonmark, gfm, history, listener, math, diagram, prism
- listener.markdownUpdated → debounced 1s auto-save via invoke write_file
- closeTab(path)

**Step 2:** Wire up in main.ts: listen for "file-open" events from filetree + "open-file" from Tauri (pane CLI)

**Step 3:** Verify opening and editing .md files

**Step 4:** Commit

---

### Task 11: Frontend — Keyboard shortcuts + quick open

**Files:**
- Create: `src/quickopen.ts`
- Modify: `src/main.ts`

**Step 1:** Create quickopen.ts:
- QuickOpen overlay: text input + filtered file list
- Fuzzy match against all .md files from list_directory
- Enter → open selected file
- Escape → close overlay

**Step 2:** Add keyboard shortcuts in main.ts:
- Cmd+P → toggle quick open
- Cmd+B → toggle sidebar
- Cmd+\ → toggle focus terminal/editor
- Cmd+W → close current tab

**Step 3:** Verify all shortcuts work

**Step 4:** Commit

---

### Task 12: Integration + polish

**Step 1:** Test full flow: open app, use terminal, open files from tree, edit, auto-save
**Step 2:** Test `pane open` CLI command from terminal
**Step 3:** Fix any issues found
**Step 4:** Final commit
