# Pane v2: Raw ProseMirror Markdown Editor

**Date:** 2026-03-03
**Status:** Approved

## Goal

Strip terminal, replace Milkdown with raw ProseMirror. Hyper-fast, clean WYSIWYG markdown editor for software engineering / CTO workflow. Opens .md files instantly via CLI (`pane <file>`) or Cmd+P.

## Remove

- `src/terminal.ts`, `src/layout.ts`
- `src-tauri/src/pty.rs`
- All `@xterm/*` deps
- `portable-pty` cargo dep
- `@milkdown/*` deps
- Terminal panel from `index.html`
- Drag handle between panels

## Keep

- `src/quickopen.ts` — Cmd+P fuzzy file picker
- `src-tauri/src/fs_ops.rs` — file read/write/search
- `src-tauri/src/settings.rs` — settings management
- `src-tauri/src/watcher.rs` — filesystem watching
- `src-tauri/src/socket.rs` — Unix socket for CLI
- Tab system concept (rewritten)
- CLI binary (simplified to `pane <file>`)

## New Frontend Structure

```
src/
  main.ts              — app init, global shortcuts
  editor/
    schema.ts          — ProseMirror schema
    plugins.ts         — keymaps, input rules, history, drop cursor
    markdown.ts        — markdown-it parser + serializer via prosemirror-markdown
    view.ts            — EditorView creation, mount/unmount
    slash.ts           — slash command menu
    toolbar.ts         — floating format toolbar
    blocks.ts          — block drag handles + action menu
    highlight.ts       — Prism code block highlighting
    mermaid.ts         — mermaid block: live-rendered diagrams
  tabs.ts              — tab management
  quickopen.ts         — kept
  styles.css           — full-screen editor theme
```

## ProseMirror Dependencies

- prosemirror-model, prosemirror-state, prosemirror-view, prosemirror-transform
- prosemirror-markdown (uses markdown-it)
- prosemirror-keymap, prosemirror-inputrules
- prosemirror-history, prosemirror-commands
- prosemirror-dropcursor, prosemirror-gapcursor
- prosemirror-tables (for GFM table editing)

## Schema

### Nodes
- doc, paragraph, heading (1-6), code_block (lang attr, Prism highlight)
- blockquote, bullet_list, ordered_list, list_item
- task_list, task_item (clickable checkboxes)
- horizontal_rule, image
- table, table_row, table_header, table_cell
- mermaid_block — fenced ```mermaid, live-rendered via mermaid lib

### Marks
- strong, em, code, link, strikethrough

### Input Rules
- `# ` → H1 ... `###### ` → H6
- `- ` / `* ` → bullet, `1. ` → ordered, `- [ ] ` → task
- `> ` → blockquote, ``` → code block, `---` → hr
- `**text**` → bold, `*text*` → italic, `` `text` `` → code

## UI/UX

### Layout
- Single full-screen editor. No sidebar. Tab bar at top (~32px).

### Tab Bar
- File name, yellow unsaved dot, X close button
- Cmd+W closes, click switches, Cmd+P or CLI creates

### Slash Commands
- `/` at start of empty block → dropdown
- Categories: Text, Lists, Code, Media, Table
- Arrow nav, Enter select, Escape dismiss, fuzzy filter

### Floating Toolbar
- Text selection → floating bar above
- Bold, Italic, Strikethrough, Code, Link

### Block Handles
- Hover left edge → drag handle (⠿)
- Drag to reorder
- Click → action menu (delete, duplicate, turn into...)

### Mermaid Blocks
- `/diagram` or ```mermaid → code editor
- Live diagram render below source
- Click diagram → toggle to source edit
- Stored as standard ```mermaid fence in .md

### Theme
- Dark theme, current CSS variable system

### Keyboard Shortcuts
- Cmd+S save, Cmd+P quick open, Cmd+W close tab
- Cmd+B bold, Cmd+I italic, Cmd+E code, Cmd+K link
- Cmd+Z undo, Cmd+Shift+Z redo

## CLI

Change `pane open <file>` → `pane <file>`.
- Resolve to absolute path
- Connect to ~/.pane.sock
- Send `{"cmd":"open","path":"..."}`
- Running Pane instance opens file as new tab

## Window Model

- Reuse existing window via socket
- CLI opens file in running instance as new tab
- If Pane not running, error message suggesting to launch it
