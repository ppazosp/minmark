import { Plugin, PluginKey } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

const blocksKey = new PluginKey("blocks");

export function blockPlugin(): Plugin {
  const handle = document.createElement("div");
  handle.className = "block-handle";
  handle.draggable = true;
  handle.textContent = "\u2807";
  document.body.appendChild(handle);

  let currentPos: number | null = null;
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;

  function showHandle(rect: DOMRect, editorRect: DOMRect) {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
    handle.style.display = "block";
    handle.style.top = rect.top + "px";
    handle.style.left = editorRect.left - 28 + "px";
  }

  function hideHandle() {
    handle.style.display = "none";
    currentPos = null;
  }

  function delayedHide() {
    if (hideTimeout) clearTimeout(hideTimeout);
    hideTimeout = setTimeout(hideHandle, 200);
  }

  // Keep handle visible when mouse enters it
  handle.addEventListener("mouseenter", () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
  });

  handle.addEventListener("mouseleave", () => {
    delayedHide();
  });

  handle.addEventListener("dragstart", (e: DragEvent) => {
    if (currentPos != null && e.dataTransfer) {
      e.dataTransfer.setData("text/plain", String(currentPos));
    }
  });

  return new Plugin({
    key: blocksKey,

    props: {
      handleDOMEvents: {
        mousemove(view: EditorView, event: MouseEvent) {
          const editorDom = view.dom;
          const editorRect = editorDom.getBoundingClientRect();
          const mouseX = event.clientX;

          if (mouseX > editorRect.left + 48) {
            delayedHide();
            return false;
          }

          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (!pos) {
            delayedHide();
            return false;
          }

          const $pos = view.state.doc.resolve(pos.pos);
          // Find top-level block: depth where parent is doc
          let blockPos: number | null = null;
          for (let d = $pos.depth; d >= 1; d--) {
            if ($pos.node(d - 1).type.name === "doc") {
              blockPos = $pos.before(d);
              break;
            }
          }

          if (blockPos == null) {
            delayedHide();
            return false;
          }

          const domNode = view.nodeDOM(blockPos);
          if (!domNode || !(domNode instanceof HTMLElement)) {
            delayedHide();
            return false;
          }

          const blockRect = domNode.getBoundingClientRect();
          currentPos = blockPos;
          showHandle(blockRect, editorRect);
          return false;
        },

        mouseleave(_view: EditorView, _event: MouseEvent) {
          delayedHide();
          return false;
        },

        drop(view: EditorView, event: DragEvent) {
          if (!event.dataTransfer) return false;
          const raw = event.dataTransfer.getData("text/plain");
          if (!raw) return false;

          const fromPos = parseInt(raw, 10);
          if (isNaN(fromPos)) return false;

          const coords = { left: event.clientX, top: event.clientY };
          const dropResult = view.posAtCoords(coords);
          if (!dropResult) return false;

          const $drop = view.state.doc.resolve(dropResult.pos);
          let targetBlockPos: number | null = null;
          for (let d = $drop.depth; d >= 1; d--) {
            if ($drop.node(d - 1).type.name === "doc") {
              targetBlockPos = $drop.before(d);
              break;
            }
          }

          if (targetBlockPos == null) return false;

          const sourceNode = view.state.doc.nodeAt(fromPos);
          if (!sourceNode) return false;

          const tr = view.state.tr;

          // Delete source node first
          tr.delete(fromPos, fromPos + sourceNode.nodeSize);

          // Adjust target position after deletion
          const mappedTarget = tr.mapping.map(targetBlockPos);
          tr.insert(mappedTarget, sourceNode);

          view.dispatch(tr);
          event.preventDefault();
          hideHandle();
          return true;
        },
      },
    },

    view() {
      return {
        destroy() {
          hideHandle();
          if (handle.parentNode) {
            handle.parentNode.removeChild(handle);
          }
        },
      };
    },
  });
}
