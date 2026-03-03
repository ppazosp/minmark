# ProseMirror Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace terminal + Milkdown with a raw ProseMirror WYSIWYG markdown editor — full-screen, slash commands, floating toolbar, block handles, mermaid diagrams, Prism code highlighting.

**Architecture:** Single-panel full-screen editor. Raw ProseMirror with custom schema supporting GFM markdown + mermaid blocks. Tab system preserved. CLI simplified to `pane <file>`. Rust backend stripped of PTY, keeps fs/socket/watcher.

**Tech Stack:** ProseMirror (model, state, view, markdown, keymap, inputrules, history, commands, dropcursor, gapcursor, tables), Prism.js, Mermaid, DOMPurify (for sanitizing rendered HTML), Tauri v2, vanilla TypeScript, Vite.

---

### Task 1: Strip Terminal & Milkdown — Rust Backend

**Files:**
- Delete: `src-tauri/src/pty.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`

**Step 1: Delete pty.rs**

Delete the file `src-tauri/src/pty.rs`.

**Step 2: Update lib.rs — remove PTY references**

Remove from `src-tauri/src/lib.rs`:
- `mod pty;` line
- `use pty::PtyState;` line
- `app.manage(PtyState::new());` line
- `pty::init_pty, pty::write_to_pty, pty::resize_pty,` from `invoke_handler`

Updated `lib.rs`:
```rust
mod fs_ops;
mod settings;
mod socket;
mod watcher;

use tauri::menu::{AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager};

#[tauri::command]
fn get_cwd(state: tauri::State<'_, WorkingDir>) -> String {
    state.0.clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();

            let cwd = std::env::args()
                .nth(1)
                .unwrap_or_else(|| {
                    let dir = std::env::current_dir()
                        .unwrap_or_else(|_| std::path::PathBuf::from("."));
                    let dir = if dir.ends_with("src-tauri") {
                        dir.parent().unwrap_or(&dir).to_path_buf()
                    } else {
                        dir
                    };
                    if dir == std::path::PathBuf::from("/") {
                        std::env::var("HOME").unwrap_or_else(|_| "/".to_string())
                    } else {
                        dir.to_string_lossy().to_string()
                    }
                });

            let watch_folders = settings::get_search_folders();
            watcher::start_watcher(handle.clone(), &watch_folders)
                .expect("Failed to start file watcher");

            socket::start_socket_listener(handle.clone());

            app.manage(WorkingDir(cwd));

            // Native menu
            let settings_item = MenuItemBuilder::new("Settings...")
                .id("settings")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;

            let app_submenu = SubmenuBuilder::new(app, "Pane")
                .about(Some(AboutMetadataBuilder::new().build()))
                .separator()
                .item(&settings_item)
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&app_submenu, &edit_submenu])
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                if event.id() == settings_item.id() {
                    let _ = app_handle.emit("open-settings", ());
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_cwd,
            fs_ops::list_directory,
            fs_ops::read_file,
            fs_ops::write_file,
            fs_ops::search_files,
            settings::get_search_folders,
            settings::open_settings,
        ])
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                socket::cleanup_socket();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running pane");
}

struct WorkingDir(String);
```

**Step 3: Remove portable-pty from Cargo.toml**

Remove `portable-pty = "0.9"` from `[dependencies]` in `src-tauri/Cargo.toml`.

**Step 4: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: compiles with no errors.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat[backend]: strip PTY/terminal from Rust backend"
```

---

### Task 2: Strip Frontend — Remove Terminal, Layout, Milkdown

**Files:**
- Delete: `src/terminal.ts`
- Delete: `src/layout.ts`
- Delete: `src/editor.ts` (will be rewritten)
- Modify: `package.json`
- Modify: `index.html`
- Modify: `src/main.ts`

**Step 1: Delete terminal.ts and layout.ts**

Delete `src/terminal.ts` and `src/layout.ts`.

**Step 2: Remove old deps, add ProseMirror deps**

Replace `package.json` dependencies:
```json
{
  "name": "pane",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2",
    "prosemirror-model": "^1",
    "prosemirror-state": "^1",
    "prosemirror-view": "^1",
    "prosemirror-transform": "^1",
    "prosemirror-markdown": "^1",
    "prosemirror-keymap": "^1",
    "prosemirror-inputrules": "^1",
    "prosemirror-history": "^1",
    "prosemirror-commands": "^1",
    "prosemirror-dropcursor": "^1",
    "prosemirror-gapcursor": "^1",
    "prosemirror-tables": "^1",
    "prosemirror-schema-list": "^1",
    "markdown-it": "^14",
    "mermaid": "^11",
    "prismjs": "^1.29.0",
    "dompurify": "^3"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "@types/dompurify": "^3",
    "@types/markdown-it": "^14",
    "@types/prismjs": "^1.26.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0"
  },
  "pnpm": {
    "onlyBuiltDependencies": [
      "esbuild"
    ]
  }
}
```

**Step 3: Install new deps**

Run: `pnpm install`

**Step 4: Simplify index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pane</title>
    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    <div id="app">
      <div id="tab-bar"></div>
      <div id="editor-container"></div>
      <div id="editor-empty">
        <span>Open a file with <kbd>&#8984;P</kbd></span>
      </div>
    </div>
    <div id="quickopen-overlay" class="hidden">
      <div id="quickopen-modal">
        <input id="quickopen-input" type="text" placeholder="Open file..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-form-type="other" />
        <ul id="quickopen-list"></ul>
      </div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

**Step 5: Stub main.ts**

```typescript
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { initQuickOpen, toggleQuickOpen } from "./quickopen";

async function init() {
  initQuickOpen((path) => {
    // TODO: openFile(path) once editor is built
    console.log("open:", path);
  });

  await listen<string>("open-file", (event) => {
    console.log("open-file:", event.payload);
  });

  await listen("open-settings", () => {
    invoke("open_settings");
  });

  document.addEventListener("keydown", (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === "p") {
      e.preventDefault();
      toggleQuickOpen();
    }
  });
}

init();
```

**Step 6: Verify frontend compiles**

Run: `pnpm build` (just tsc + vite, no tauri)
Expected: compiles. Warnings about unused imports OK at this stage.

**Step 7: Commit**

```bash
git add -A && git commit -m "feat[frontend]: strip terminal/milkdown, add prosemirror deps"
```

---

### Task 3: ProseMirror Schema

**Files:**
- Create: `src/editor/schema.ts`

**Step 1: Create the schema**

Create `src/editor/schema.ts` with a full GFM-compatible ProseMirror schema.

Key nodes: doc, paragraph, heading (1-6), code_block (with language attr), blockquote, bullet_list, ordered_list, list_item, task_list, task_item (with checked attr), horizontal_rule, image, hard_break, text, table, table_row, table_header, table_cell, mermaid_block (atom, with source attr).

Key marks: strong, em, code, link (with href/title), strikethrough.

Complete code provided in design doc. Schema uses standard ProseMirror parseDOM/toDOM for all nodes and marks.

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/editor/schema.ts && git commit -m "feat[editor]: add ProseMirror schema with GFM + mermaid"
```

---

### Task 4: Markdown Parser & Serializer

**Files:**
- Create: `src/editor/markdown.ts`

**Step 1: Create markdown parser/serializer**

Uses `prosemirror-markdown` with `markdown-it` under the hood.

Parser: maps markdown-it tokens to schema nodes/marks. Special handling for mermaid fences (parsed as code_block with language="mermaid", rendered differently by view layer).

Serializer: converts ProseMirror doc back to clean markdown text. Handles all node types including GFM tables (row-by-row serialization with `|` delimiters) and mermaid blocks (output as ` ```mermaid ` fences).

Task list support via custom markdown-it plugin that converts `- [ ]` / `- [x]` items.

Exports: `parseMarkdown(content: string)` and `serializeMarkdown(doc)`.

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/editor/markdown.ts && git commit -m "feat[editor]: add markdown parser and serializer"
```

---

### Task 5: Editor View & Plugins

**Files:**
- Create: `src/editor/plugins.ts`
- Create: `src/editor/view.ts`

**Step 1: Create plugins.ts — keymaps, input rules, history**

Input rules:
- `# ` through `###### ` → headings
- `- ` / `* ` → bullet list
- `1. ` → ordered list
- `> ` → blockquote
- ` ``` ` → code block
- `---` → horizontal rule

Keymap:
- Mod-b → bold, Mod-i → italic, Mod-e → code, Mod-Shift-s → strikethrough
- Mod-z → undo, Mod-Shift-z → redo
- Enter → split list item, Tab → sink list, Shift-Tab → lift list
- Mod-Enter → exit code block
- Alt-Up/Down → join blocks, Mod-[ → lift

buildPlugins() returns array: [inputRules, keymap, baseKeymap, history, dropCursor, gapCursor]

**Step 2: Create view.ts — EditorView management**

- `createEditor(container, content, onChange)` → creates EditorState from parsed markdown, creates EditorView with dispatch handler that calls onChange when doc changes
- `destroyEditor()` → destroys current view
- `focusProseMirror()` → focuses current view
- `getMarkdownFromView()` → serializes current doc to markdown

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/editor/plugins.ts src/editor/view.ts && git commit -m "feat[editor]: add ProseMirror plugins and view management"
```

---

### Task 6: Tab System & Main Integration

**Files:**
- Create: `src/tabs.ts`
- Modify: `src/main.ts`

**Step 1: Create tabs.ts**

Port tab logic from old editor.ts to work with new ProseMirror view:
- `openFile(path)` → invoke read_file, create tab, switchTab
- `switchTab(path)` → save current content, destroy editor, create new editor with tab content
- `saveActiveTab()` → write_file with current markdown
- `closeActiveTab()` / `closeTab(path)` → remove tab, switch to neighbor or show empty state
- `renderTabs()` → DOM rendering of tab bar (same as before)

**Step 2: Update main.ts**

Wire openFile, closeActiveTab, saveActiveTab, focusEditor from tabs.ts.
Keyboard shortcuts: Cmd+P (quick open), Cmd+W (close), Cmd+S (save).
Remove terminal toggle (Cmd+\).

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/tabs.ts src/main.ts && git commit -m "feat[editor]: add tab system and main entry point"
```

---

### Task 7: CSS — Full-Screen Editor Theme

**Files:**
- Modify: `src/styles.css`

**Step 1: Rewrite styles.css**

- Keep: CSS variables, scrollbar, tab bar, quick open overlay
- Remove: terminal panel, drag handle, milkdown-specific styles
- Add: ProseMirror editor styles (full-screen, centered max-width 800px, 32px+48px padding)
- Add: heading styles (h1-h6 with proper sizing/spacing)
- Add: code block, blockquote, list, table, hr, image styles
- Add: task list styles (custom checkbox via ::before pseudo-element)
- Add: mermaid wrapper styles
- Add: ProseMirror selection/gapcursor/placeholder styles
- Layout: `#app` becomes `flex-direction: column` (tab bar on top, editor below)

**Step 2: Commit**

```bash
git add src/styles.css && git commit -m "feat[styles]: full-screen editor CSS, remove terminal styles"
```

---

### Task 8: Delete Old editor.ts & Verify Full App Runs

**Files:**
- Delete: `src/editor.ts`

**Step 1: Delete old editor.ts**

Delete `src/editor.ts` (replaced by `src/editor/` directory and `src/tabs.ts`).

**Step 2: Run the full app**

Run: `pnpm tauri dev`

Expected: App launches, full-screen editor with tab bar. Cmd+P opens quick open. Selecting a .md file opens it in the editor. Editing works. Cmd+S saves. Cmd+W closes tab.

**Step 3: Fix any compilation issues**

Address any TS or Rust compile errors that emerge.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat[editor]: working ProseMirror editor with tabs"
```

---

### Task 9: Slash Commands

**Files:**
- Create: `src/editor/slash.ts`
- Modify: `src/editor/plugins.ts`
- Modify: `src/styles.css`

**Step 1: Create slash.ts**

ProseMirror plugin. Type `/` at start of empty paragraph → dropdown menu.

Items: Heading 1-3, Bullet List, Numbered List, Task List, Code Block, Mermaid Diagram, Blockquote, Divider, Image.

UX: Arrow keys navigate, Enter selects, Escape dismisses, fuzzy filter as you type after `/`.

Plugin mechanics:
- `handleTextInput` detects `/` in empty paragraph → `show()`
- Subsequent input updates filter query
- `handleKeyDown` intercepts arrow/enter/escape when menu is active
- `execute()` deletes the slash text, runs the item's action, hides menu
- Menu positioned via `view.coordsAtPos()`

**Step 2: Add slash menu CSS**

Positioned fixed, z-index 500, dark bg, rounded corners, category headers, selected highlight.

**Step 3: Wire into plugins.ts**

Add `slashPlugin()` to `buildPlugins()`.

**Step 4: Verify**

Type `/` at start of empty line → menu appears. Select Heading 1 → text becomes H1.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat[editor]: slash command menu"
```

---

### Task 10: Floating Toolbar

**Files:**
- Create: `src/editor/toolbar.ts`
- Modify: `src/editor/plugins.ts`
- Modify: `src/styles.css`

**Step 1: Create toolbar.ts**

ProseMirror plugin. On text selection → floating bar above selection.

Buttons: Bold (B), Italic (I), Strikethrough (S), Code (<>), Link (icon).
Each button: checks if mark is active (highlight), mousedown toggles mark.
Link button: prompts for URL if adding, removes if already linked.

Position: centered above selection via `view.coordsAtPos()`.
Hidden when: selection empty, cursor in code_block.

**Step 2: Add toolbar CSS**

Fixed position, z-index 400, flex row, dark bg, rounded, subtle shadow.

**Step 3: Wire into plugins.ts**

Add `toolbarPlugin()` to `buildPlugins()`.

Also add `Mod-k` keybinding in plugins.ts for link toggle.

**Step 4: Verify**

Select text → toolbar appears. Click Bold → text becomes bold.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat[editor]: floating format toolbar"
```

---

### Task 11: Block Drag Handles

**Files:**
- Create: `src/editor/blocks.ts`
- Modify: `src/editor/plugins.ts`
- Modify: `src/styles.css`

**Step 1: Create blocks.ts**

ProseMirror plugin. On mousemove near left edge of editor:
- Resolve position to top-level block node
- Show drag handle (grid dots icon ⠿) at left edge of that block
- Handle is `draggable=true`
- On dragstart: store source block position
- On drop: reorder — delete source node, insert at target position

**Step 2: Add block handle CSS**

Fixed position, subtle opacity, appears on hover near left edge.

**Step 3: Wire into plugins.ts**

Add `blockPlugin()` to `buildPlugins()`.

**Step 4: Verify**

Hover near left edge → handle appears. Drag to reorder blocks.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat[editor]: block drag handles"
```

---

### Task 12: Code Block Syntax Highlighting

**Files:**
- Create: `src/editor/highlight.ts`
- Modify: `src/editor/plugins.ts`
- Modify: `src/styles.css`

**Step 1: Create highlight.ts**

ProseMirror decoration plugin. On doc change:
- Walk all code_block nodes
- For each with a known language (not mermaid): tokenize with Prism
- Create inline decorations with `class="token <type>"` for each token
- Return DecorationSet

Import Prism language components: typescript, javascript, python, rust, go, bash, json, yaml, toml, css, sql, markdown, docker.

**Step 2: Add Prism dark theme CSS**

Token colors matching GitHub dark theme: comments (#6a737d), strings (#9ecbff), keywords (#f97583), functions (#b392f0), numbers (#79b8ff), etc.

**Step 3: Wire into plugins.ts**

Add `highlightPlugin()` to `buildPlugins()`.

**Step 4: Verify**

Type ` ```typescript ` and some code → syntax highlighted.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat[editor]: Prism syntax highlighting for code blocks"
```

---

### Task 13: Mermaid Diagram Rendering

**Files:**
- Create: `src/editor/mermaid.ts`
- Modify: `src/editor/view.ts`

**Step 1: Create mermaid.ts**

Custom ProseMirror NodeView for code_block nodes with `language: "mermaid"`.

Behavior:
- Renders diagram via `mermaid.render()` (dark theme)
- SVG output sanitized via DOMPurify before insertion
- Click rendered diagram → shows textarea for source editing
- Live preview: on textarea input (300ms debounce), re-render diagram
- Escape or blur → stop editing, show rendered diagram
- Stored in markdown as standard ` ```mermaid ` fence

Mermaid initialized once with dark theme config.

**Step 2: Wire MermaidNodeView into view.ts**

In `createEditor()`, add `nodeViews` option:
- code_block: if `node.attrs.language === "mermaid"`, return `new MermaidNodeView(...)`

**Step 3: Update mermaid CSS**

Wrapper with border, source textarea styling, render area centered.

**Step 4: Verify**

Type ` ```mermaid ` then `graph TD; A-->B;` → diagram renders. Click to edit.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat[editor]: mermaid diagram blocks with live rendering"
```

---

### Task 14: Placeholder Plugin

**Files:**
- Create: `src/editor/placeholder.ts`
- Modify: `src/editor/plugins.ts`
- Modify: `src/styles.css`

**Step 1: Create placeholder.ts**

ProseMirror plugin. When doc has single empty paragraph, show "Start writing..." via Decoration.widget.

**Step 2: Add placeholder CSS**

Muted color, absolutely positioned, pointer-events none.

**Step 3: Wire into plugins.ts**

Add `placeholderPlugin()` to `buildPlugins()`.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat[editor]: empty document placeholder"
```

---

### Task 15: Simplify CLI to `pane <file>`

**Files:**
- Modify: `src-tauri/src/bin/pane_cli.rs`

**Step 1: Update CLI**

Change arg parsing:
- `pane <file>` → primary usage
- `pane open <file>` → still supported (backwards compat)
- Less than 2 args → print usage and exit

Rest of logic unchanged (resolve path, connect socket, send JSON).

**Step 2: Verify Rust compiles**

Run: `cd src-tauri && cargo check`

**Step 3: Commit**

```bash
git add src-tauri/src/bin/pane_cli.rs && git commit -m "feat[cli]: simplify to pane <file>"
```

---

### Task 16: Final Integration & Polish

**Step 1: Run full app**

Run: `pnpm tauri dev`

**Step 2: Test all features**

- Cmd+P → open .md → renders in WYSIWYG
- Input rules: # heading, - list, ``` code, --- hr
- Select text → floating toolbar
- Bold/Italic/Code/Link via toolbar and shortcuts
- / → slash menu, select items
- Block drag handles on hover
- Code blocks → syntax highlighted
- Mermaid blocks → diagram rendered
- Cmd+S saves, Cmd+W closes tab
- Multiple tabs work
- CLI: `pane <file>` opens in running instance

**Step 3: Fix issues found during testing**

**Step 4: Final commit**

```bash
git add -A && git commit -m "feat[editor]: raw ProseMirror WYSIWYG editor — complete"
```
