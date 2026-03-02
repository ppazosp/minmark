import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

let terminal: Terminal;
let fitAddon: FitAddon;
let fitPending = false;

function requestFit() {
  if (!fitPending) {
    fitPending = true;
    requestAnimationFrame(() => {
      fitAddon.fit();
      terminal.scrollToBottom();
      fitPending = false;
    });
  }
}

export async function initTerminal() {
  const container = document.getElementById("terminal-container")!;

  // Ensure the Nerd Font is loaded before xterm renders its canvas
  try {
    await document.fonts.load('13px "FiraCode Nerd Font Mono"');
  } catch {
    // Font not available, will fall through to next in stack
  }

  terminal = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily:
      '"FiraCode Nerd Font Mono", "FiraCode Nerd Font", "SF Mono", "Fira Code", "Cascadia Code", "JetBrains Mono", ui-monospace, monospace',
    scrollback: 5000,
    theme: {
      background: "#0a0a0a",
      foreground: "#d4d4d4",
      cursor: "#d4d4d4",
      selectionBackground: "#2a2a2a",
      black: "#0a0a0a",
      red: "#e06c75",
      green: "#98c379",
      yellow: "#e5c07b",
      blue: "#61afef",
      magenta: "#c678dd",
      cyan: "#56b6c2",
      white: "#e0e0e0",
      brightBlack: "#5c6370",
      brightRed: "#e06c75",
      brightGreen: "#98c379",
      brightYellow: "#e5c07b",
      brightBlue: "#61afef",
      brightMagenta: "#c678dd",
      brightCyan: "#56b6c2",
      brightWhite: "#ffffff",
    },
  });

  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  terminal.open(container);

  try {
    const webglAddon = new WebglAddon();
    webglAddon.onContextLoss(() => webglAddon.dispose());
    terminal.loadAddon(webglAddon);
  } catch {
    // WebGL not available, fall back to canvas renderer
  }

  fitAddon.fit();

  // Spawn PTY with the correct initial size
  const cwd = await invoke<string>("get_cwd");
  await invoke("init_pty", { cwd, cols: terminal.cols, rows: terminal.rows });

  // Forward user input to PTY
  terminal.onData(async (data) => {
    await invoke("write_to_pty", { data });
  });

  // Forward PTY resize
  terminal.onResize(async ({ cols, rows }) => {
    await invoke("resize_pty", { cols, rows });
  });

  // Listen for PTY output
  await listen<string>("pty-output", (event) => {
    terminal.write(event.payload);
  });

  // Handle all resize sources
  const resizeObserver = new ResizeObserver(() => requestFit());
  resizeObserver.observe(container);
  window.addEventListener("resize", () => requestFit());
  window.addEventListener("pane-resize", () => requestFit());
}

export function focusTerminal() {
  terminal?.focus();
}
