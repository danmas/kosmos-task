// @bun
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __require = import.meta.require;

// src/env.ts
var LLM_BASE_URL = process.env.LLM_SERVER_URL || "http://localhost:3002";
var LLM_API_KEY = process.env.LLM_API_KEY || "";
var LLM_MODEL = process.env.LLM_MODEL || "RICH";
var DATA_DIR = process.env.MYDATA || "./data";

// src/llm.ts
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
var HISTORY_FILE = join(process.cwd(), "history.json");
function loadHistory() {
  if (!existsSync(HISTORY_FILE))
    return [];
  try {
    return JSON.parse(readFileSync(HISTORY_FILE, "utf-8"));
  } catch {
    return [];
  }
}
function saveHistory(entry) {
  const history = loadHistory();
  history.push(entry);
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
}
async function callLLM(messages, model = LLM_MODEL) {
  const headers = {
    "Content-Type": "application/json"
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
        temperature: 0.3
      })
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
  } catch (e) {
    if (!e.message.startsWith("LLM error")) {
      saveHistory({ timestamp, model, messages, response: "", error: e.message });
    }
    throw e;
  }
}

// src/task-factory.ts
import { readFile, writeFile, mkdir } from "fs/promises";
import { join as join2, dirname } from "path";
import { fileURLToPath } from "url";
var __dirname2 = dirname(fileURLToPath(import.meta.url));
var ROOT = __dirname2;
var PROMPTS_DIR = join2(ROOT, "..", "prompts");
var LOGS_DIR = join2(ROOT, "..", "logs");
var OUTPUT_DIR = join2(ROOT, "..", DATA_DIR);
await mkdir(LOGS_DIR, { recursive: true });
await mkdir(OUTPUT_DIR, { recursive: true });
var QUESTIONS_PROMPT = await readFile(join2(PROMPTS_DIR, "task-factory-questions.md"), "utf-8");
var GENERATOR_PROMPT = await readFile(join2(PROMPTS_DIR, "task-factory-generator.md"), "utf-8");
var clean = (obj) => {
  if (typeof obj === "string") {
    return obj.replace(/\u0000/g, "").replace(/\r\n/g, `
`).replace(/\r/g, "").replace(/\\r\\n/g, `
`).replace(/\\n/g, `
`).replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\n{3,}/g, `

`).trim();
  }
  if (Array.isArray(obj))
    return obj.map(clean);
  if (obj && typeof obj === "object") {
    const cleaned = {};
    for (const [k, v] of Object.entries(obj)) {
      cleaned[k] = clean(v);
    }
    return cleaned;
  }
  return obj;
};
var saveDebugLog = async (data, suffix = "") => {
  const ts = Date.now();
  const jsonPath = join2(LOGS_DIR, `task-factory-debug-${ts}${suffix}.json`);
  const txtPath = join2(LOGS_DIR, `task-factory-debug-${ts}${suffix}.txt`);
  const cleaned = clean(JSON.parse(JSON.stringify(data)));
  await writeFile(jsonPath, JSON.stringify(cleaned, null, 2));
  let txtContent = `=== KOSMOS TASK FACTORY DEBUG LOG ===
`;
  txtContent += `\u0412\u0440\u0435\u043C\u044F: ${new Date().toLocaleString("ru-RU")}
`;
  txtContent += `\u0426\u0435\u043B\u044C: ${cleaned.goal}

`;
  txtContent += `=== STAGE 1: \u0412\u041E\u041F\u0420\u041E\u0421\u042B ===
`;
  if (cleaned.stage1?.response) {
    txtContent += `${cleaned.stage1.response}

`;
  }
  txtContent += `=== \u041E\u0422\u0412\u0415\u0422\u042B \u041F\u041E\u041B\u042C\u0417\u041E\u0412\u0410\u0422\u0415\u041B\u042F ===
`;
  if (cleaned.answers && Array.isArray(cleaned.answers)) {
    cleaned.answers.forEach((a, i) => {
      txtContent += `${i + 1}) ${a.question}
   \u2192 ${a.answer}
`;
    });
  }
  txtContent += `
`;
  txtContent += `=== STAGE 2: \u0413\u0415\u041D\u0415\u0420\u0410\u0426\u0418\u042F ===
`;
  txtContent += cleaned.generatedFile || "(\u043D\u0435 \u0441\u0433\u0435\u043D\u0435\u0440\u0438\u0440\u043E\u0432\u0430\u043D)";
  txtContent += `
`;
  await writeFile(txtPath, txtContent);
  console.log(`
\uD83D\uDCDD \u041E\u0442\u043B\u0430\u0434\u043A\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430:
   JSON \u2192 ${jsonPath}
   TXT  \u2192 ${txtPath}`);
};
function parseQuestions(response) {
  const lines = response.split(`
`);
  const questions = [];
  for (const line of lines) {
    const match = line.match(/^\d+\.\s*(.+)$/);
    if (match) {
      questions.push(match[1].trim());
    }
  }
  return questions;
}
console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
console.log("\u2551   Kosmos Task Factory v1.0             \u2551");
console.log("\u2551   \u0413\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440 .kosmos.md \u0444\u0430\u0439\u043B\u043E\u0432          \u2551");
console.log(`\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D
`);
console.log(`\u041E\u043F\u0438\u0448\u0438 \u0437\u0430\u0434\u0430\u0447\u0443 \u043E\u0434\u043D\u043E\u0439 \u0444\u0440\u0430\u0437\u043E\u0439.
`);
var goal = prompt("\u0426\u0435\u043B\u044C \u2192 ")?.trim() || "";
if (!goal) {
  console.log("\u0426\u0435\u043B\u044C \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u0430. \u0412\u044B\u0445\u043E\u0434.");
  process.exit(0);
}
console.log(`
\uD83C\uDFAF \u0426\u0435\u043B\u044C: ${goal}
`);
console.log(`\uD83D\uDD04 \u0413\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u044E \u0443\u0442\u043E\u0447\u043D\u044F\u044E\u0449\u0438\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B...
`);
var stage1Messages = [
  { role: "system", content: QUESTIONS_PROMPT },
  { role: "user", content: goal }
];
var questionsResponse = await callLLM(stage1Messages);
var questions = parseQuestions(questionsResponse);
if (questions.length === 0) {
  console.log(`\u26A0\uFE0F LLM \u043D\u0435 \u0441\u0433\u0435\u043D\u0435\u0440\u0438\u0440\u043E\u0432\u0430\u043B \u0432\u043E\u043F\u0440\u043E\u0441\u044B. \u041F\u0435\u0440\u0435\u0445\u043E\u0434 \u043A \u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u0438 \u0431\u0435\u0437 \u0443\u0442\u043E\u0447\u043D\u0435\u043D\u0438\u0439.
`);
}
console.log(`\uD83D\uDCCB \u041E\u0442\u0432\u0435\u0442\u044C \u043D\u0430 \u0432\u043E\u043F\u0440\u043E\u0441\u044B (Enter = \u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u0442\u044C):
`);
var answersData = [];
for (let i = 0;i < questions.length; i++) {
  const q = questions[i];
  console.log(`${i + 1}) ${q}`);
  const a = prompt("   \u2192 ")?.trim() || "[\u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E]";
  answersData.push({ question: q, answer: a });
}
console.log(`
\uD83D\uDD04 \u0413\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u044E .kosmos.md \u0444\u0430\u0439\u043B...
`);
var answersContext = "";
if (answersData.length > 0) {
  answersContext = `

\u0423\u0442\u043E\u0447\u043D\u0435\u043D\u0438\u044F \u043E\u0442 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F:
`;
  answersData.forEach((a, i) => {
    if (a.answer !== "[\u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E]") {
      answersContext += `${i + 1}. ${a.question}: ${a.answer}
`;
    }
  });
}
var today = new Date().toISOString().split("T")[0];
var stage2Messages = [
  { role: "system", content: GENERATOR_PROMPT },
  { role: "user", content: `\u0426\u0435\u043B\u044C: ${goal}${answersContext}

\u0422\u0435\u043A\u0443\u0449\u0430\u044F \u0434\u0430\u0442\u0430: ${today}

\u0421\u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u0439 .kosmos.md \u0444\u0430\u0439\u043B.` }
];
var generatedFile = await callLLM(stage2Messages);
var titleMatch = generatedFile.match(/^#\s*(.+?)\s*\.kosmos\.md/m);
var fileName = titleMatch ? titleMatch[1].toLowerCase().replace(/[^a-z\u0430-\u044F\u04510-9]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") : `task-${Date.now()}`;
var outputPath = join2(OUTPUT_DIR, `${fileName}.kosmos.md`);
await writeFile(outputPath, generatedFile);
console.log(`
\u2705 \u0424\u0430\u0439\u043B \u0441\u043E\u0437\u0434\u0430\u043D: ${outputPath}`);
var debugLog = {
  timestamp: new Date().toISOString(),
  goal,
  stage1: {
    messages: stage1Messages,
    response: questionsResponse
  },
  answers: answersData,
  stage2: {
    messages: stage2Messages
  },
  generatedFile,
  outputPath
};
await saveDebugLog(debugLog);
console.log(`
` + "\u2500".repeat(50));
console.log("\u0414\u043B\u044F \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435:");
console.log(`  node kosmos-runner-cli.js "${outputPath}"`);
console.log("\u2500".repeat(50));
var runNow = prompt(`
\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0441\u0435\u0439\u0447\u0430\u0441? (y/N) \u2192 `)?.trim().toLowerCase();
if (runNow === "y") {
  const { spawn } = await import("child_process");
  spawn("node", ["kosmos-runner-cli.js", outputPath], {
    cwd: join2(ROOT, ".."),
    stdio: "inherit"
  });
}
console.log(`
\uD83C\uDF89 \u0413\u043E\u0442\u043E\u0432\u043E!`);
