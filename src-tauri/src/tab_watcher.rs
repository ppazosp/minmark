use notify::{recommended_watcher, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

// Per-tab file watcher. Subscribes only to the specific files the user has
// open as tabs — bounded scope, no FileIdMap, no directory-tree recursion.
pub struct TabWatcher {
    inner: Mutex<Inner>,
}

struct Inner {
    watcher: RecommendedWatcher,
    watched: HashSet<PathBuf>,
}

impl TabWatcher {
    pub fn new(app: AppHandle) -> Result<Self, notify::Error> {
        // Coalesce duplicate events for the same path within a short window
        // (atomic writes typically fire Create + Modify back-to-back).
        let dedupe: Mutex<Vec<(PathBuf, Instant)>> = Mutex::new(Vec::new());
        let app_handle = app.clone();
        let watcher = recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
            let Ok(event) = res else { return };
            if !matches!(
                event.kind,
                EventKind::Modify(_) | EventKind::Create(_) | EventKind::Any
            ) {
                return;
            }
            let now = Instant::now();
            let mut last = dedupe.lock().unwrap();
            last.retain(|(_, t)| now.duration_since(*t) < Duration::from_millis(500));
            for p in event.paths {
                if last.iter().any(|(q, _)| q == &p) {
                    continue;
                }
                last.push((p.clone(), now));
                let _ = app_handle.emit("file-changed", p.to_string_lossy().to_string());
            }
        })?;
        Ok(TabWatcher {
            inner: Mutex::new(Inner {
                watcher,
                watched: HashSet::new(),
            }),
        })
    }
}

#[tauri::command]
pub fn watch_file(path: String, state: tauri::State<'_, TabWatcher>) -> Result<(), String> {
    let p = PathBuf::from(&path);
    let mut inner = state.inner.lock().map_err(|e| e.to_string())?;
    if inner.watched.insert(p.clone()) {
        inner
            .watcher
            .watch(&p, RecursiveMode::NonRecursive)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn unwatch_file(path: String, state: tauri::State<'_, TabWatcher>) -> Result<(), String> {
    let p = PathBuf::from(&path);
    let mut inner = state.inner.lock().map_err(|e| e.to_string())?;
    if inner.watched.remove(&p) {
        // Unwatching a path that was already removed (e.g., file deleted) returns
        // an error from notify — ignore it; the entry is gone from our set.
        let _ = inner.watcher.unwatch(&p);
    }
    Ok(())
}

pub fn install(app: &tauri::App) -> Result<(), notify::Error> {
    let watcher = TabWatcher::new(app.handle().clone())?;
    app.manage(watcher);
    Ok(())
}
