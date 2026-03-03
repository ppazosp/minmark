import { invoke } from "@tauri-apps/api/core";
import {
  createEditor,
  destroyEditor,
  focusProseMirror,
  getMarkdownFromView,
} from "./editor/view";

interface Tab {
  path: string;
  name: string;
  content: string;
  unsaved: boolean;
}

let tabs: Tab[] = [];
let activeTabPath: string | null = null;

export async function openFile(path: string) {
  const existing = tabs.find((t) => t.path === path);
  if (existing) {
    switchTab(path);
    return;
  }

  const content = await invoke<string>("read_file", { path });
  const name = path.split("/").pop() || path;
  tabs.push({ path, name, content, unsaved: false });
  switchTab(path);
}

function switchTab(path: string) {
  if (activeTabPath) {
    const current = tabs.find((t) => t.path === activeTabPath);
    if (current) {
      const md = getMarkdownFromView();
      if (md !== null) current.content = md;
    }
  }

  activeTabPath = path;
  renderTabs();

  const tab = tabs.find((t) => t.path === path);
  if (!tab) return;

  const container = document.getElementById("editor-container")!;
  const empty = document.getElementById("editor-empty")!;

  container.classList.add("visible");
  empty.classList.add("hidden");

  destroyEditor();
  while (container.firstChild) container.removeChild(container.firstChild);

  createEditor(container, tab.content, (markdown) => {
    onContentChanged(path, markdown);
  });
}

function onContentChanged(path: string, markdown: string) {
  const tab = tabs.find((t) => t.path === path);
  if (!tab) return;
  tab.content = markdown;
  if (!tab.unsaved) {
    tab.unsaved = true;
    renderTabs();
  }
}

export async function saveActiveTab() {
  if (!activeTabPath) return;
  const tab = tabs.find((t) => t.path === activeTabPath);
  if (!tab || !tab.unsaved) return;

  const md = getMarkdownFromView();
  if (md !== null) tab.content = md;

  try {
    await invoke("write_file", { path: tab.path, content: tab.content });
    tab.unsaved = false;
    renderTabs();
  } catch (e) {
    console.error("Failed to save:", e);
  }
}

export function closeActiveTab() {
  if (!activeTabPath) return;
  closeTab(activeTabPath);
}

function closeTab(path: string) {
  const idx = tabs.findIndex((t) => t.path === path);
  if (idx === -1) return;

  tabs.splice(idx, 1);

  if (activeTabPath === path) {
    if (tabs.length > 0) {
      const newIdx = Math.min(idx, tabs.length - 1);
      switchTab(tabs[newIdx].path);
    } else {
      activeTabPath = null;
      destroyEditor();
      const container = document.getElementById("editor-container")!;
      container.classList.remove("visible");
      while (container.firstChild) container.removeChild(container.firstChild);
      document.getElementById("editor-empty")!.classList.remove("hidden");
      renderTabs();
    }
  } else {
    renderTabs();
  }
}

function renderTabs() {
  const tabBar = document.getElementById("tab-bar")!;
  while (tabBar.firstChild) tabBar.removeChild(tabBar.firstChild);

  for (const tab of tabs) {
    const tabEl = document.createElement("div");
    tabEl.className = `tab${tab.path === activeTabPath ? " active" : ""}${tab.unsaved ? " unsaved" : ""}`;

    const dot = document.createElement("span");
    dot.className = "unsaved-dot";
    tabEl.appendChild(dot);

    const label = document.createElement("span");
    label.textContent = tab.name;
    tabEl.appendChild(label);

    const closeBtn = document.createElement("span");
    closeBtn.className = "close-btn";
    closeBtn.textContent = "\u00d7";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(tab.path);
    });
    tabEl.appendChild(closeBtn);

    tabEl.addEventListener("click", () => switchTab(tab.path));
    tabBar.appendChild(tabEl);
  }
}

export function focusEditor() {
  focusProseMirror();
}
