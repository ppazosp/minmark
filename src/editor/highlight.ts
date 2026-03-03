import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { Node } from "prosemirror-model";
import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-go";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-toml";
import "prismjs/components/prism-css";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-docker";

const highlightKey = new PluginKey("highlight");

type PrismToken = string | Prism.Token;

function getTokenLength(token: PrismToken): number {
  if (typeof token === "string") return token.length;
  if (typeof token.content === "string") return token.content.length;
  if (Array.isArray(token.content)) {
    return token.content.reduce((sum: number, t: PrismToken) => sum + getTokenLength(t), 0);
  }
  return 0;
}

function flattenTokens(
  tokens: PrismToken[],
  offset: number,
  decorations: Decoration[]
): number {
  for (const token of tokens) {
    if (typeof token === "string") {
      offset += token.length;
    } else {
      const length = getTokenLength(token);
      decorations.push(
        Decoration.inline(offset, offset + length, {
          class: "token " + token.type,
        })
      );
      if (Array.isArray(token.content)) {
        flattenTokens(token.content as PrismToken[], offset, decorations);
      }
      offset += length;
    }
  }
  return offset;
}

function getDecorations(doc: Node): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== "code_block") return;

    const language = node.attrs.language as string;
    if (!language || language === "mermaid") return;

    const grammar = Prism.languages[language];
    if (!grammar) return;

    const text = node.textContent;
    const tokens = Prism.tokenize(text, grammar);

    // +1 to skip the opening of the code_block node
    flattenTokens(tokens, pos + 1, decorations);
  });

  return DecorationSet.create(doc, decorations);
}

export function highlightPlugin(): Plugin {
  return new Plugin({
    key: highlightKey,

    state: {
      init(_, { doc }) {
        return getDecorations(doc);
      },
      apply(tr, decorations) {
        if (tr.docChanged) {
          return getDecorations(tr.doc);
        }
        return decorations.map(tr.mapping, tr.doc);
      },
    },

    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}
