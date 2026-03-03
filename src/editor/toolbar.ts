import { Plugin, PluginKey } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { toggleMark } from "prosemirror-commands";
import { schema } from "./schema";
import { TextSelection } from "prosemirror-state";

// --- Types ---

interface ToolbarButton {
  label: string;
  mark: keyof typeof schema.marks | "link";
  style?: string;
  action: (view: EditorView) => void;
}

// --- Plugin state ---

const toolbarKey = new PluginKey("toolbar");

let toolbarEl: HTMLDivElement | null = null;

function ensureToolbar(): HTMLDivElement {
  if (!toolbarEl) {
    toolbarEl = document.createElement("div");
    toolbarEl.className = "floating-toolbar";
    document.body.appendChild(toolbarEl);
  }
  return toolbarEl;
}

function getButtons(): ToolbarButton[] {
  return [
    {
      label: "B",
      mark: "strong",
      style: "font-weight:700",
      action: (v) => {
        toggleMark(schema.marks.strong)(v.state, v.dispatch);
        v.focus();
      },
    },
    {
      label: "I",
      mark: "em",
      style: "font-style:italic",
      action: (v) => {
        toggleMark(schema.marks.em)(v.state, v.dispatch);
        v.focus();
      },
    },
    {
      label: "S",
      mark: "strikethrough",
      style: "text-decoration:line-through",
      action: (v) => {
        toggleMark(schema.marks.strikethrough)(v.state, v.dispatch);
        v.focus();
      },
    },
    {
      label: "<>",
      mark: "code",
      style: "font-family:var(--font-mono);font-size:11px",
      action: (v) => {
        toggleMark(schema.marks.code)(v.state, v.dispatch);
        v.focus();
      },
    },
    {
      label: "Link",
      mark: "link",
      action: (v) => {
        const { from, to } = v.state.selection;
        const hasLink = v.state.doc.rangeHasMark(from, to, schema.marks.link);
        if (hasLink) {
          toggleMark(schema.marks.link)(v.state, v.dispatch);
        } else {
          const href = prompt("URL:");
          if (href) {
            toggleMark(schema.marks.link, { href })(v.state, v.dispatch);
          }
        }
        v.focus();
      },
    },
  ];
}

function renderToolbar(view: EditorView) {
  const el = ensureToolbar();
  const { from, to } = view.state.selection;

  // Clear previous content
  while (el.firstChild) el.removeChild(el.firstChild);

  const buttons = getButtons();
  for (const btn of buttons) {
    const buttonEl = document.createElement("button");
    buttonEl.className = "toolbar-btn";
    buttonEl.textContent = btn.label;
    if (btn.style) buttonEl.setAttribute("style", btn.style);

    // Check if mark is active
    const markType = schema.marks[btn.mark as keyof typeof schema.marks];
    if (markType && view.state.doc.rangeHasMark(from, to, markType)) {
      buttonEl.classList.add("active");
    }

    buttonEl.addEventListener("mousedown", (e) => {
      e.preventDefault();
      btn.action(view);
    });

    el.appendChild(buttonEl);
  }
}

function positionToolbar(view: EditorView) {
  const el = ensureToolbar();
  const { from, to } = view.state.selection;
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);
  const top = Math.min(start.top, end.top) - 40;
  const left = (start.left + end.left) / 2;

  el.style.top = top + "px";
  el.style.left = left + "px";
  el.style.transform = "translateX(-50%)";
  el.style.display = "flex";
}

function hideToolbar() {
  if (toolbarEl) {
    toolbarEl.style.display = "none";
  }
}

// --- Plugin ---

export function toolbarPlugin(): Plugin {
  return new Plugin({
    key: toolbarKey,

    view() {
      return {
        update(view: EditorView) {
          const { state } = view;
          const { selection } = state;

          // Only show for non-empty text selections in textblocks (not code_block)
          if (
            !(selection instanceof TextSelection) ||
            selection.empty
          ) {
            hideToolbar();
            return;
          }

          const $from = selection.$from;
          if ($from.parent.type === schema.nodes.code_block) {
            hideToolbar();
            return;
          }

          renderToolbar(view);
          positionToolbar(view);
        },
        destroy() {
          hideToolbar();
          if (toolbarEl) {
            toolbarEl.remove();
            toolbarEl = null;
          }
        },
      };
    },
  });
}
