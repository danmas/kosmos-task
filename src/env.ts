// src/env.ts — загрузка переменных окружения для LLM

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "..", "config.json");

function loadConfig(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

const cfg = loadConfig();

export const LLM_BASE_URL = cfg.LLM_BASE_URL || process.env.LLM_SERVER_URL || "http://localhost:3002";
export const LLM_API_KEY = process.env.LLM_API_KEY || "";
export const LLM_MODEL = cfg.LLM_MODEL || process.env.LLM_MODEL || "RICH";
export const DATA_DIR = cfg.DATA_DIR || process.env.MYDATA || "./data";
