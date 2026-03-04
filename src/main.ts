import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openFile, closeActiveTab, saveActiveTab, reloadTabFromDisk, focusEditor, toggleSwitcher, handleSwitcherKeydown, handleSwitcherKeyup, toggleSourceMode, initSourceEditor } from "./tabs";
import { initQuickOpen, toggleQuickOpen } from "./quickopen";
import "prosemirror-view/style/prosemirror.css";
import "prosemirror-gapcursor/style/gapcursor.css";
import "prosemirror-tables/style/tables.css";

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
let currentZoom = 1.0;

function applyZoom() {
  (document.documentElement.style as any).zoom = String(currentZoom);
}

function zoomIn() {
  currentZoom = Math.min(ZOOM_MAX, +(currentZoom + ZOOM_STEP).toFixed(2));
  applyZoom();
}

function zoomOut() {
  currentZoom = Math.max(ZOOM_MIN, +(currentZoom - ZOOM_STEP).toFixed(2));
  applyZoom();
}

function zoomReset() {
  currentZoom = 1.0;
  applyZoom();
}

async function init() {
  initQuickOpen((path) => openFile(path));
  initSourceEditor();

  await listen<string>("open-file", (event) => {
    openFile(event.payload);
  });

  await listen<string[]>("files-modified", (event) => {
    for (const path of event.payload) {
      reloadTabFromDisk(path);
    }
  });

  await listen("open-settings", () => {
    invoke("open_settings");
  });

  document.addEventListener("keydown", (e) => {
    // Let switcher handle keys first when open
    if (handleSwitcherKeydown(e)) return;

    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.key === "t") {
      e.preventDefault();
      toggleSwitcher();
    } else if (mod && e.key === "p") {
      e.preventDefault();
      toggleQuickOpen();
    } else if (mod && e.key === "w") {
      e.preventDefault();
      closeActiveTab();
    } else if (mod && e.key === "g") {
      e.preventDefault();
      toggleSourceMode();
    } else if (mod && e.key === "s") {
      e.preventDefault();
      saveActiveTab();
    } else if (mod && (e.key === "=" || e.key === "+")) {
      e.preventDefault();
      zoomIn();
    } else if (mod && e.key === "-") {
      e.preventDefault();
      zoomOut();
    } else if (mod && e.key === "0") {
      e.preventDefault();
      zoomReset();
    }
  });

  document.addEventListener("keyup", (e) => handleSwitcherKeyup(e));

  focusEditor();

  // Signal backend that frontend listeners are registered
  await invoke("frontend_ready");

  // Show window after frontend is ready (prevents white flash)
  await getCurrentWindow().show();
}

init();
