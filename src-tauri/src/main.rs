#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::{CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu};
use clipboard::{ClipboardContext, ClipboardProvider};
use chrono::Local;
use std::sync::{Arc, Mutex};

#[derive(Clone, serde::Serialize)]
struct ClipboardEntry {
  content: String,
  timestamp: String,
}

struct ClipboardState(Arc<Mutex<Vec<ClipboardEntry>>>);

#[tauri::command]
fn get_clipboard_history(state: tauri::State<ClipboardState>) -> Vec<ClipboardEntry> {
  state.0.lock().unwrap().clone()
}

#[tauri::command]
fn copy_to_clipboard(content: String) -> Result<(), String> {
  let mut ctx: ClipboardContext = ClipboardProvider::new().map_err(|e| e.to_string())?;
  ctx.set_contents(content).map_err(|e| e.to_string())
}

fn main() {
  let clipboard_state = ClipboardState(Arc::new(Mutex::new(Vec::new())));
  let clipboard_state_clone = clipboard_state.0.clone();

  let quit = CustomMenuItem::new("quit".to_string(), "Quit");
  let hide = CustomMenuItem::new("hide".to_string(), "Hide");
  let show = CustomMenuItem::new("show".to_string(), "Show");
  let tray_menu = SystemTrayMenu::new()
    .add_item(quit)
    .add_item(hide)
    .add_item(show);
  let system_tray = SystemTray::new().with_menu(tray_menu);

  tauri::Builder::default()
    .manage(clipboard_state)
    .system_tray(system_tray)
    .on_system_tray_event(|app, event| match event {
      SystemTrayEvent::MenuItemClick { id, .. } => {
        match id.as_str() {
          "quit" => {
            std::process::exit(0);
          }
          "hide" => {
            let window = app.get_window("main").unwrap();
            window.hide().unwrap();
          }
          "show" => {
            let window = app.get_window("main").unwrap();
            window.show().unwrap();
          }
          _ => {}
        }
      }
      _ => {}
    })
    .setup(|app| {
      let app_handle = app.handle();
      std::thread::spawn(move || {
        let mut ctx: ClipboardContext = ClipboardProvider::new().unwrap();
        let mut last_content = String::new();

        loop {
          if let Ok(content) = ctx.get_contents() {
            if !content.is_empty() && content != last_content {
              let mut history = clipboard_state_clone.lock().unwrap();
              history.push(ClipboardEntry {
                content: content.clone(),
                timestamp: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
              });
              if history.len() > 100 {
                history.remove(0);
              }
              last_content = content;
              app_handle.emit_all("clipboard-update", ()).unwrap();
            }
          }
          std::thread::sleep(std::time::Duration::from_millis(500));
        }
      });
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![get_clipboard_history, copy_to_clipboard])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}