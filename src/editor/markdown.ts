import { MarkdownParser, MarkdownSerializer } from "prosemirror-markdown";
import markdownit from "markdown-it";
import { Node as ProsemirrorNode } from "prosemirror-model";
import { schema } from "./schema";

// --- Markdown-it instance ---

const md = markdownit("commonmark", { html: false });
md.enable(["strikethrough", "table"]);

// --- Parser ---

export const markdownParser = new MarkdownParser(schema, md, {
  blockquote: { block: "blockquote" },
  paragraph: { block: "paragraph" },
  list_item: { block: "list_item" },
  bullet_list: { block: "bullet_list" },
  ordered_list: {
    block: "ordered_list",
    getAttrs: (tok) => ({ order: +(tok.attrGet("start") || 1) }),
  },
  heading: {
    block: "heading",
    getAttrs: (tok) => ({ level: +tok.tag.slice(1) }),
  },
  code_block: { block: "code_block", noCloseToken: true },
  fence: {
    block: "code_block",
    getAttrs: (tok) => ({ language: tok.info.trim().split(/\s+/)[0] || "" }),
    noCloseToken: true,
  },
  hr: { node: "horizontal_rule" },
  image: {
    node: "image",
    getAttrs: (tok) => ({
      src: tok.attrGet("src") || "",
      alt: tok.children?.[0]?.content || null,
      title: tok.attrGet("title") || null,
    }),
  },
  hardbreak: { node: "hard_break" },
  // Table tokens — map markdown-it tokens to schema nodes
  table: { block: "table" },
  thead: { ignore: true },
  tbody: { ignore: true },
  tr: { block: "table_row" },
  th: { block: "table_header" },
  td: { block: "table_cell" },
  // Marks
  em: { mark: "em" },
  strong: { mark: "strong" },
  s: { mark: "strikethrough" },
  link: {
    mark: "link",
    getAttrs: (tok) => ({
      href: tok.attrGet("href") || "",
      title: tok.attrGet("title") || null,
    }),
  },
  code_inline: { mark: "code", noCloseToken: true },
});

// --- Serializer ---

export const markdownSerializer = new MarkdownSerializer(
  {
    doc(state, node) {
      state.renderContent(node);
    },

    paragraph(state, node) {
      state.renderInline(node);
      state.closeBlock(node);
    },

    heading(state, node) {
      state.write(state.repeat("#", node.attrs.level) + " ");
      state.renderInline(node);
      state.closeBlock(node);
    },

    code_block(state, node) {
      const lang = node.attrs.language || "";
      // Check if it's a mermaid block coming through as code_block
      state.write("```" + lang + "\n");
      state.text(node.textContent, false);
      state.ensureNewLine();
      state.write("```");
      state.closeBlock(node);
    },

    blockquote(state, node) {
      state.wrapBlock("> ", null, node, () => state.renderContent(node));
    },

    bullet_list(state, node) {
      state.renderList(node, "  ", () => "- ");
    },

    ordered_list(state, node) {
      const start: number = node.attrs.order || 1;
      state.renderList(node, "   ", (i) => `${start + i}. `);
    },

    list_item(state, node) {
      state.renderContent(node);
    },

    task_list(state, node) {
      state.renderList(node, "  ", () => "- ");
    },

    task_item(state, node) {
      const prefix = node.attrs.checked ? "[x] " : "[ ] ";
      state.write(prefix);
      state.renderContent(node);
    },

    horizontal_rule(state, node) {
      state.write("---");
      state.closeBlock(node);
    },

    image(state, node) {
      const alt = state.esc(node.attrs.alt || "");
      const src = node.attrs.src || "";
      const title = node.attrs.title;
      state.write(
        "![" + alt + "](" + src + (title ? ' "' + title.replace(/"/g, '\\"') + '"' : "") + ")"
      );
    },

    hard_break(state, node, parent, index) {
      // Avoid trailing hard_break at end of block
      for (let i = index + 1; i < parent.childCount; i++) {
        if (parent.child(i).type !== node.type) {
          state.write("  \n");
          return;
        }
      }
    },

    text(state, node) {
      state.text(node.text || "");
    },

    table(state, node) {
      // Collect rows
      const rows: ProsemirrorNode[] = [];
      node.forEach((row) => rows.push(row));

      if (rows.length === 0) {
        state.closeBlock(node);
        return;
      }

      // Determine column count from first row
      const colCount = rows[0].childCount;

      // Calculate column widths for alignment
      const colWidths: number[] = new Array(colCount).fill(3); // minimum "---"

      // Measure all cells
      const cellTexts: string[][] = rows.map((row) => {
        const cells: string[] = [];
        row.forEach((cell) => {
          const text = cell.textContent;
          cells.push(text);
          const idx = cells.length - 1;
          if (idx < colCount) {
            colWidths[idx] = Math.max(colWidths[idx], text.length);
          }
        });
        return cells;
      });

      // Render first row (header)
      const headerCells = cellTexts[0] || [];
      state.write(
        "| " + headerCells.map((c, i) => c.padEnd(colWidths[i])).join(" | ") + " |"
      );
      state.ensureNewLine();

      // Render separator
      state.write(
        "| " + colWidths.map((w) => "-".repeat(w)).join(" | ") + " |"
      );
      state.ensureNewLine();

      // Render body rows
      for (let r = 1; r < cellTexts.length; r++) {
        const cells = cellTexts[r];
        state.write(
          "| " + cells.map((c, i) => c.padEnd(colWidths[i])).join(" | ") + " |"
        );
        state.ensureNewLine();
      }

      state.closeBlock(node);
    },

    table_row(_state, _node) {
      // Handled by table serializer
    },

    table_header(_state, _node) {
      // Handled by table serializer
    },

    table_cell(_state, _node) {
      // Handled by table serializer
    },

    mermaid_block(state, node) {
      state.write("```mermaid\n");
      state.text(node.attrs.source || "", false);
      state.ensureNewLine();
      state.write("```");
      state.closeBlock(node);
    },
  },
  {
    em: {
      open: "*",
      close: "*",
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    strong: {
      open: "**",
      close: "**",
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    code: { open: "`", close: "`", escape: false },
    link: {
      open(_state, _mark) {
        return "[";
      },
      close(_state, mark) {
        const href = mark.attrs.href || "";
        const title = mark.attrs.title;
        return (
          "](" + href + (title ? ' "' + title.replace(/"/g, '\\"') + '"' : "") + ")"
        );
      },
    },
    strikethrough: { open: "~~", close: "~~" },
  }
);

// --- Helper functions ---

export function parseMarkdown(content: string): ProsemirrorNode {
  return markdownParser.parse(content);
}

export function serializeMarkdown(doc: ProsemirrorNode): string {
  return markdownSerializer.serialize(doc);
}
