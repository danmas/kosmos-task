import { LLM_BASE_URL, LLM_API_KEY, LLM_MODEL } from "./env";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

type Message = { role: "system" | "user" | "assistant"; content: string };

interface HistoryEntry {
  timestamp: string;
  model: string;
  messages: Message[];
  response: string;
  error?: string;
}

const HISTORY_FILE = join(process.cwd(), "history.json");

function loadHistory(): HistoryEntry[] {
  if (!existsSync(HISTORY_FILE)) return [];
  try {
    return JSON.parse(readFileSync(HISTORY_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveHistory(entry: HistoryEntry) {
  const history = loadHistory();
  history.push(entry);
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
}

export async function callLLM(messages: Message[], model = LLM_MODEL): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (LLM_API_KEY) {
    headers["Authorization"] = `Bearer ${LLM_API_KEY}`;
  }

  const timestamp = new Date().toISOString();
  
  try {
    const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      saveHistory({ timestamp, model, messages, response: "", error: errorText });
      throw new Error(`LLM error ${res.status}: ${errorText}`);
    }

    const json = await res.json();
    const response = json.choices[0].message.content;
    
    saveHistory({ timestamp, model, messages, response });
    
    return response;
  } catch (e: any) {
    if (!e.message.startsWith("LLM error")) {
      saveHistory({ timestamp, model, messages, response: "", error: e.message });
    }
    throw e;
  }
}
