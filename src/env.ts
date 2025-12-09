// src/env.ts — загрузка переменных окружения для LLM

export const LLM_BASE_URL = process.env.LLM_SERVER_URL || "http://localhost:3002";
export const LLM_API_KEY = process.env.LLM_API_KEY || "";
export const LLM_MODEL = process.env.LLM_MODEL || "RICH";
export const DATA_DIR = process.env.MYDATA || "./data";
