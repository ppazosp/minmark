import { EditorState } from "prosemirror-state";
import { EditorView, NodeView } from "prosemirror-view";
import { Node as PMNode } from "prosemirror-model";
import { schema } from "./schema";
import { buildPlugins } from "./plugins";
import { parseMarkdown, serializeMarkdown } from "./markdown";
import { MermaidNodeView } from "./mermaid";
import { convertFileSrc } from "@tauri-apps/api/core";

let currentView: EditorView | null = null;

class ImageNodeView implements NodeView {
  dom: HTMLElement;

  constructor(node: PMNode, baseDir: string) {
    const img = document.createElement("img");
    const src = node.attrs.src || "";
    if (src && !src.startsWith("http") && !src.startsWith("data:") && !src.startsWith("asset")) {
      const abs = src.startsWith("/") ? src : baseDir + "/" + src;
      img.src = convertFileSrc(abs);
    } else {
      img.src = src;
    }
    if (node.attrs.alt) img.alt = node.attrs.alt;
    if (node.attrs.title) img.title = node.attrs.title;
    this.dom = img;
  }
}

export function createEditor(
  container: HTMLElement,
  content: string,
  baseDir: string,
  onChange: (markdown: string) => void
): EditorView {
  destroyEditor();

  const doc =
    parseMarkdown(content) ||
    schema.nodes.doc.create(null, schema.nodes.paragraph.create());

  const state = EditorState.create({
    doc,
    plugins: buildPlugins(),
  });

  const view = new EditorView(container, {
    state,
    dispatchTransaction(tr) {
      const newState = view.state.apply(tr);
      view.updateState(newState);
      if (tr.docChanged) {
        onChange(serializeMarkdown(newState.doc));
      }
    },
    nodeViews: {
      code_block(node, view, getPos) {
        if (node.attrs.language === "mermaid") {
          return new MermaidNodeView(node, view, getPos);
        }
        return undefined as any;
      },
      image(node) {
        return new ImageNodeView(node, baseDir);
      },
    },
    attributes: { class: "pane-editor" },
  });

  currentView = view;
  return view;
}

export function destroyEditor() {
  if (currentView) {
    currentView.destroy();
    currentView = null;
  }
}

export function focusProseMirror() {
  currentView?.focus();
}

export function getMarkdownFromView(): string | null {
  if (!currentView) return null;
  return serializeMarkdown(currentView.state.doc);
}
