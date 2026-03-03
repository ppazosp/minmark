import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { initQuickOpen, toggleQuickOpen } from "./quickopen";

async function init() {
  initQuickOpen((path) => {
    console.log("open:", path);
  });

  await listen<string>("open-file", (event) => {
    console.log("open-file:", event.payload);
  });

  await listen("open-settings", () => {
    invoke("open_settings");
  });

  document.addEventListener("keydown", (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === "p") {
      e.preventDefault();
      toggleQuickOpen();
    }
  });
}

init();
