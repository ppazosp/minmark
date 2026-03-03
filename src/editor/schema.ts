import { Schema, NodeSpec, MarkSpec, DOMOutputSpec } from "prosemirror-model";

// --- Nodes ---

const nodes: Record<string, NodeSpec> = {
  doc: {
    content: "block+",
  },

  paragraph: {
    content: "inline*",
    group: "block",
    parseDOM: [{ tag: "p" }],
    toDOM(): DOMOutputSpec {
      return ["p", 0];
    },
  },

  heading: {
    attrs: { level: { default: 1 } },
    content: "inline*",
    group: "block",
    defining: true,
    parseDOM: [
      { tag: "h1", attrs: { level: 1 } },
      { tag: "h2", attrs: { level: 2 } },
      { tag: "h3", attrs: { level: 3 } },
      { tag: "h4", attrs: { level: 4 } },
      { tag: "h5", attrs: { level: 5 } },
      { tag: "h6", attrs: { level: 6 } },
    ],
    toDOM(node): DOMOutputSpec {
      return ["h" + node.attrs.level, 0];
    },
  },

  code_block: {
    attrs: { language: { default: "" } },
    content: "text*",
    marks: "",
    group: "block",
    code: true,
    defining: true,
    parseDOM: [
      {
        tag: "pre",
        preserveWhitespace: "full" as const,
        getAttrs(node) {
          const el = node as HTMLElement;
          const code = el.querySelector("code");
          const cls = code?.className || "";
          const match = cls.match(/language-(\S+)/);
          return { language: match ? match[1] : "" };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      const lang = node.attrs.language;
      return ["pre", ["code", lang ? { class: `language-${lang}` } : {}, 0]];
    },
  },

  blockquote: {
    content: "block+",
    group: "block",
    defining: true,
    parseDOM: [{ tag: "blockquote" }],
    toDOM(): DOMOutputSpec {
      return ["blockquote", 0];
    },
  },

  bullet_list: {
    content: "list_item+",
    group: "block",
    parseDOM: [{ tag: "ul:not(.task-list)" }],
    toDOM(): DOMOutputSpec {
      return ["ul", 0];
    },
  },

  ordered_list: {
    attrs: { order: { default: 1 } },
    content: "list_item+",
    group: "block",
    parseDOM: [
      {
        tag: "ol",
        getAttrs(node) {
          const el = node as HTMLElement;
          return { order: el.hasAttribute("start") ? +el.getAttribute("start")! : 1 };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      return node.attrs.order === 1
        ? ["ol", 0]
        : ["ol", { start: node.attrs.order }, 0];
    },
  },

  list_item: {
    content: "paragraph block*",
    defining: true,
    parseDOM: [{ tag: "li:not([data-task])" }],
    toDOM(): DOMOutputSpec {
      return ["li", 0];
    },
  },

  task_list: {
    content: "task_item+",
    group: "block",
    parseDOM: [{ tag: "ul.task-list" }],
    toDOM(): DOMOutputSpec {
      return ["ul", { class: "task-list" }, 0];
    },
  },

  task_item: {
    attrs: { checked: { default: false } },
    content: "paragraph block*",
    defining: true,
    parseDOM: [
      {
        tag: "li[data-task]",
        getAttrs(node) {
          const el = node as HTMLElement;
          return { checked: el.getAttribute("data-checked") === "true" };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      return [
        "li",
        {
          "data-task": "",
          "data-checked": node.attrs.checked ? "true" : "false",
        },
        0,
      ];
    },
  },

  horizontal_rule: {
    group: "block",
    parseDOM: [{ tag: "hr" }],
    toDOM(): DOMOutputSpec {
      return ["hr"];
    },
  },

  image: {
    inline: true,
    attrs: {
      src: {},
      alt: { default: null },
      title: { default: null },
    },
    group: "inline",
    draggable: true,
    parseDOM: [
      {
        tag: "img[src]",
        getAttrs(node) {
          const el = node as HTMLElement;
          return {
            src: el.getAttribute("src"),
            alt: el.getAttribute("alt"),
            title: el.getAttribute("title"),
          };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      const { src, alt, title } = node.attrs;
      return ["img", { src, alt, title }];
    },
  },

  hard_break: {
    inline: true,
    group: "inline",
    selectable: false,
    parseDOM: [{ tag: "br" }],
    toDOM(): DOMOutputSpec {
      return ["br"];
    },
  },

  text: {
    group: "inline",
  },

  table: {
    content: "table_row+",
    group: "block",
    tableRole: "table",
    isolating: true,
    parseDOM: [{ tag: "table" }],
    toDOM(): DOMOutputSpec {
      return ["table", ["tbody", 0]];
    },
  },

  table_row: {
    content: "(table_cell | table_header)*",
    tableRole: "row",
    parseDOM: [{ tag: "tr" }],
    toDOM(): DOMOutputSpec {
      return ["tr", 0];
    },
  },

  table_header: {
    content: "inline*",
    attrs: {
      colspan: { default: 1 },
      rowspan: { default: 1 },
    },
    tableRole: "header_cell",
    isolating: true,
    parseDOM: [
      {
        tag: "th",
        getAttrs(node) {
          const el = node as HTMLElement;
          return {
            colspan: +(el.getAttribute("colspan") || 1),
            rowspan: +(el.getAttribute("rowspan") || 1),
          };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      const attrs: Record<string, string> = {};
      if (node.attrs.colspan !== 1) attrs.colspan = node.attrs.colspan;
      if (node.attrs.rowspan !== 1) attrs.rowspan = node.attrs.rowspan;
      return ["th", attrs, 0];
    },
  },

  table_cell: {
    content: "inline*",
    attrs: {
      colspan: { default: 1 },
      rowspan: { default: 1 },
    },
    tableRole: "cell",
    isolating: true,
    parseDOM: [
      {
        tag: "td",
        getAttrs(node) {
          const el = node as HTMLElement;
          return {
            colspan: +(el.getAttribute("colspan") || 1),
            rowspan: +(el.getAttribute("rowspan") || 1),
          };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      const attrs: Record<string, string> = {};
      if (node.attrs.colspan !== 1) attrs.colspan = node.attrs.colspan;
      if (node.attrs.rowspan !== 1) attrs.rowspan = node.attrs.rowspan;
      return ["td", attrs, 0];
    },
  },

  mermaid_block: {
    attrs: { source: { default: "" } },
    group: "block",
    atom: true,
    selectable: true,
    draggable: true,
    parseDOM: [
      {
        tag: "div.mermaid-block",
        getAttrs(node) {
          const el = node as HTMLElement;
          return { source: el.getAttribute("data-source") || "" };
        },
      },
    ],
    toDOM(node): DOMOutputSpec {
      return ["div", { class: "mermaid-block", "data-source": node.attrs.source }];
    },
  },
};

// --- Marks ---

const marks: Record<string, MarkSpec> = {
  strong: {
    parseDOM: [
      { tag: "strong" },
      {
        tag: "b",
        getAttrs(node) {
          const el = node as HTMLElement;
          return el.style.fontWeight !== "normal" ? null : false;
        },
      },
      {
        style: "font-weight=bold",
      },
      {
        style: "font-weight",
        getAttrs(value) {
          const v = value as string;
          if (/^(bold(er)?|[5-9]\d{2})$/.test(v)) return null;
          return false;
        },
      },
    ],
    toDOM(): DOMOutputSpec {
      return ["strong", 0];
    },
  },

  em: {
    parseDOM: [
      { tag: "i" },
      { tag: "em" },
      { style: "font-style=italic" },
    ],
    toDOM(): DOMOutputSpec {
      return ["em", 0];
    },
  },

  code: {
    parseDOM: [{ tag: "code" }],
    toDOM(): DOMOutputSpec {
      return ["code", 0];
    },
  },

  link: {
    attrs: {
      href: {},
      title: { default: null },
    },
    inclusive: false,
    parseDOM: [
      {
        tag: "a[href]",
        getAttrs(node) {
          const el = node as HTMLElement;
          return {
            href: el.getAttribute("href"),
            title: el.getAttribute("title"),
          };
        },
      },
    ],
    toDOM(mark): DOMOutputSpec {
      const { href, title } = mark.attrs;
      return ["a", { href, title, rel: "noopener noreferrer" }, 0];
    },
  },

  strikethrough: {
    parseDOM: [
      { tag: "s" },
      { tag: "del" },
      { style: "text-decoration=line-through" },
    ],
    toDOM(): DOMOutputSpec {
      return ["s", 0];
    },
  },
};

export const schema = new Schema({ nodes, marks });
