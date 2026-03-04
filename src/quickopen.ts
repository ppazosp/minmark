import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface FileEntry {
  name: string;
  path: string;
}

interface CachedEntry {
  name: string;
  path: string;
  nameLower: string;
  pathLower: string;
}

const MAX_RENDERED = 50;

// --- Cache ---
let cachedFiles: CachedEntry[] | null = null;
let homeDir = "";

async function getFiles(): Promise<CachedEntry[]> {
  if (cachedFiles) return cachedFiles;
  try {
    const folders = await invoke<string[]>("get_search_folders");
    if (!homeDir && folders.length > 0) {
      const m = folders[0].match(/^(\/Users\/[^/]+)/);
      if (m) homeDir = m[1];
    }
    const raw = await invoke<FileEntry[]>("search_files");
    cachedFiles = raw.map((f) => ({
      name: f.name,
      path: f.path,
      nameLower: f.name.toLowerCase(),
      pathLower: f.path.toLowerCase(),
    }));
  } catch {
    cachedFiles = [];
  }
  return cachedFiles;
}

function invalidateCache() {
  cachedFiles = null;
}

// --- State ---
let isOpen = false;
let selectedIndex = 0;
let filteredFiles: CachedEntry[] = [];
let onSelect: (path: string) => void = () => {};

// --- Debounce ---
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let usingKeyboard = false;

export function initQuickOpen(selectCallback: (path: string) => void) {
  onSelect = selectCallback;

  listen("fs-changed", invalidateCache);

  const overlay = document.getElementById("quickopen-overlay")!;
  const input = document.getElementById("quickopen-input") as HTMLInputElement;
  const list = document.getElementById("quickopen-list")!;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeQuickOpen();
  });

  input.addEventListener("input", () => {
    usingKeyboard = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => filterFiles(input.value), 150);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeQuickOpen();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      usingKeyboard = true;
      moveSelection(Math.min(selectedIndex + 1, filteredFiles.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      usingKeyboard = true;
      moveSelection(Math.max(selectedIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredFiles[selectedIndex]) {
        onSelect(filteredFiles[selectedIndex].path);
        closeQuickOpen();
      }
    }
  });

  // Single delegated event listener on <ul>
  list.addEventListener("click", (e) => {
    const li = (e.target as HTMLElement).closest("li");
    if (!li) return;
    const idx = Number(li.dataset.idx);
    if (filteredFiles[idx]) {
      onSelect(filteredFiles[idx].path);
      closeQuickOpen();
    }
  });

  list.addEventListener("mouseenter", (e) => {
    if (usingKeyboard) return;
    const li = (e.target as HTMLElement).closest("li");
    if (!li) return;
    moveSelection(Number(li.dataset.idx));
  }, true);

  list.addEventListener("mousemove", () => {
    usingKeyboard = false;
  });
}

export async function toggleQuickOpen() {
  if (isOpen) {
    closeQuickOpen();
  } else {
    await openQuickOpen();
  }
}

async function openQuickOpen() {
  isOpen = true;
  const overlay = document.getElementById("quickopen-overlay")!;
  const input = document.getElementById("quickopen-input") as HTMLInputElement;

  overlay.classList.remove("hidden");
  input.value = "";
  selectedIndex = 0;

  filteredFiles = await getFiles();
  renderList();
  input.focus();
}

function closeQuickOpen() {
  isOpen = false;
  document.getElementById("quickopen-overlay")!.classList.add("hidden");
}

async function filterFiles(query: string) {
  const allFiles = await getFiles();
  const q = query.toLowerCase();

  if (!q) {
    filteredFiles = allFiles;
  } else {
    // Score inline with parallel arrays to avoid object allocation
    const scores = new Int8Array(allFiles.length);
    for (let i = 0; i < allFiles.length; i++) {
      const f = allFiles[i];
      if (f.nameLower === q) scores[i] = 4;
      else if (f.nameLower.startsWith(q)) scores[i] = 3;
      else if (f.nameLower.includes(q)) scores[i] = 2;
      else if (fuzzyMatch(q, f.nameLower) || fuzzyMatch(q, f.pathLower))
        scores[i] = 1;
    }

    // Collect indices with score > 0
    const indices: number[] = [];
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] > 0) indices.push(i);
    }
    indices.sort((a, b) => scores[b] - scores[a]);

    filteredFiles = indices.map((i) => allFiles[i]);
  }

  selectedIndex = 0;
  renderList();
}

function fuzzyMatch(query: string, target: string): boolean {
  let qi = 0;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) qi++;
  }
  return qi === query.length;
}

// --- DOM: move selection without full rebuild ---
function moveSelection(newIndex: number) {
  if (newIndex === selectedIndex) return;
  const list = document.getElementById("quickopen-list")!;
  const items = list.children;

  if (items[selectedIndex]) items[selectedIndex].classList.remove("selected");
  selectedIndex = newIndex;
  if (items[selectedIndex]) {
    items[selectedIndex].classList.add("selected");
    (items[selectedIndex] as HTMLElement).scrollIntoView({ block: "nearest" });
  }
}

function renderList() {
  const list = document.getElementById("quickopen-list")!;
  const frag = document.createDocumentFragment();
  const cap = Math.min(filteredFiles.length, MAX_RENDERED);

  for (let i = 0; i < cap; i++) {
    const file = filteredFiles[i];
    const li = document.createElement("li");
    li.dataset.idx = String(i);
    if (i === selectedIndex) li.className = "selected";

    const nameSpan = document.createElement("span");
    nameSpan.className = "file-name";
    nameSpan.textContent = file.name;
    li.appendChild(nameSpan);

    const pathSpan = document.createElement("span");
    pathSpan.className = "file-path";
    const dir = file.path.substring(0, file.path.lastIndexOf("/"));
    pathSpan.textContent = dir.replace(homeDir, "~");
    li.appendChild(pathSpan);

    frag.appendChild(li);
  }

  list.textContent = "";
  list.appendChild(frag);
}
