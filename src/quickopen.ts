import { invoke } from "@tauri-apps/api/core";

interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
  children: DirEntry[] | null;
}

async function getAllFiles(): Promise<{ name: string; path: string }[]> {
  try {
    const rootPath = await invoke<string>("get_home_dir");
    const entries = await invoke<DirEntry[]>("list_directory", {
      path: rootPath,
    });
    const files: { name: string; path: string }[] = [];
    flattenEntries(entries, files);
    return files;
  } catch {
    return [];
  }
}

function flattenEntries(
  entries: DirEntry[],
  out: { name: string; path: string }[]
) {
  for (const entry of entries) {
    if (entry.isDir && entry.children) {
      flattenEntries(entry.children, out);
    } else if (!entry.isDir) {
      out.push({ name: entry.name, path: entry.path });
    }
  }
}

let isOpen = false;
let selectedIndex = 0;
let filteredFiles: { name: string; path: string }[] = [];
let onSelect: (path: string) => void = () => {};

export function initQuickOpen(selectCallback: (path: string) => void) {
  onSelect = selectCallback;

  const overlay = document.getElementById("quickopen-overlay")!;
  const input = document.getElementById("quickopen-input") as HTMLInputElement;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeQuickOpen();
    }
  });

  input.addEventListener("input", () => {
    filterFiles(input.value);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeQuickOpen();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filteredFiles.length - 1);
      renderList();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      renderList();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredFiles[selectedIndex]) {
        onSelect(filteredFiles[selectedIndex].path);
        closeQuickOpen();
      }
    }
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

  // Fetch all files
  filteredFiles = await getAllFiles();
  renderList();

  input.focus();
}

function closeQuickOpen() {
  isOpen = false;
  document.getElementById("quickopen-overlay")!.classList.add("hidden");
}

function filterFiles(query: string) {
  const q = query.toLowerCase();
  if (!q) {
    getAllFiles().then((files) => {
      filteredFiles = files;
      selectedIndex = 0;
      renderList();
    });
    return;
  }

  getAllFiles().then((allFiles) => {
    filteredFiles = allFiles
      .map((f) => {
        const name = f.name.toLowerCase();
        const path = f.path.toLowerCase();
        let score = 0;
        if (name === q) score = 4;
        else if (name.startsWith(q)) score = 3;
        else if (name.includes(q)) score = 2;
        else if (fuzzyMatch(q, name) || fuzzyMatch(q, path)) score = 1;
        return { ...f, score };
      })
      .filter((f) => f.score > 0)
      .sort((a, b) => b.score - a.score);
    selectedIndex = 0;
    renderList();
  });
}

function fuzzyMatch(query: string, target: string): boolean {
  let qi = 0;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) {
      qi++;
    }
  }
  return qi === query.length;
}

function renderList() {
  const list = document.getElementById("quickopen-list")!;

  while (list.firstChild) {
    list.removeChild(list.firstChild);
  }

  for (let i = 0; i < filteredFiles.length; i++) {
    const file = filteredFiles[i];
    const li = document.createElement("li");
    if (i === selectedIndex) {
      li.className = "selected";
    }

    const nameSpan = document.createElement("span");
    nameSpan.className = "file-name";
    nameSpan.textContent = file.name;
    li.appendChild(nameSpan);

    const pathSpan = document.createElement("span");
    pathSpan.className = "file-path";
    pathSpan.textContent = file.path;
    li.appendChild(pathSpan);

    li.addEventListener("click", () => {
      onSelect(file.path);
      closeQuickOpen();
    });

    li.addEventListener("mouseenter", () => {
      selectedIndex = i;
      renderList();
    });

    list.appendChild(li);
  }

  // Scroll selected item into view
  const selected = list.querySelector(".selected") as HTMLElement;
  if (selected) {
    selected.scrollIntoView({ block: "nearest" });
  }
}
