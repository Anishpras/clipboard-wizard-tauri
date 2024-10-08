"use client";

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";

interface ClipboardEntry {
  content: string;
  timestamp: string;
}

export default function Home() {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);

  useEffect(() => {
    const fetchEntries = async () => {
      const history = await invoke<ClipboardEntry[]>("get_clipboard_history");
      setEntries(history);
    };

    fetchEntries();
    const interval = setInterval(fetchEntries, 5000);

    const unlisten = listen("clipboard-update", (event) => {
      fetchEntries();
    });

    return () => {
      clearInterval(interval);
      unlisten.then((f) => f());
    };
  }, []);

  const copyToClipboard = async (content: string) => {
    await invoke("copy_to_clipboard", { content });
  };

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Clipboard History</h1>
      <div className="space-y-2">
        {entries.map((entry, index) => (
          <div
            key={index}
            className="flex items-center justify-between bg-gray-100 p-2 rounded">
            <div className="flex-1 truncate text-black">{entry.content}</div>
            <div className="text-sm text-gray-500 mx-2">{entry.timestamp}</div>
            <button
              onClick={() => copyToClipboard(entry.content)}
              className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">
              Copy
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
