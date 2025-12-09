// src/task-factory.ts — v1.0 — Генератор .kosmos.md файлов
// Двухпроходная схема: вопросы → генерация

import { callLLM } from "./llm.ts";
import { DATA_DIR } from "./env.ts";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PROMPTS_DIR = join(ROOT, "..", "prompts");
const LOGS_DIR = join(ROOT, "..", "logs");
const OUTPUT_DIR = join(ROOT, "..", DATA_DIR);

await mkdir(LOGS_DIR, { recursive: true });
await mkdir(OUTPUT_DIR, { recursive: true });

// Загрузка промптов
const QUESTIONS_PROMPT = await readFile(join(PROMPTS_DIR, "task-factory-questions.md"), "utf-8");
const GENERATOR_PROMPT = await readFile(join(PROMPTS_DIR, "task-factory-generator.md"), "utf-8");

// === УТИЛИТЫ ДЛЯ КРАСИВЫХ ЛОГОВ ===
const clean = (obj: any): any => {
    if (typeof obj === "string") {
        return obj
            .replace(/\u0000/g, "")
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "")
            .replace(/\\r\\n/g, "\n")
            .replace(/\\n/g, "\n")
            .replace(/\\t/g, "\t")
            .replace(/\\"/g, '"')
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    }
    if (Array.isArray(obj)) return obj.map(clean);
    if (obj && typeof obj === "object") {
        const cleaned: any = {};
        for (const [k, v] of Object.entries(obj)) {
            cleaned[k] = clean(v);
        }
        return cleaned;
    }
    return obj;
};

const saveDebugLog = async (data: any, suffix: string = "") => {
    const ts = Date.now();
    const jsonPath = join(LOGS_DIR, `task-factory-debug-${ts}${suffix}.json`);
    const txtPath = join(LOGS_DIR, `task-factory-debug-${ts}${suffix}.txt`);

    const cleaned = clean(JSON.parse(JSON.stringify(data)));

    await writeFile(jsonPath, JSON.stringify(cleaned, null, 2));

    let txtContent = `=== KOSMOS TASK FACTORY DEBUG LOG ===\n`;
    txtContent += `Время: ${new Date().toLocaleString("ru-RU")}\n`;
    txtContent += `Цель: ${cleaned.goal}\n\n`;

    txtContent += `=== STAGE 1: ВОПРОСЫ ===\n`;
    if (cleaned.stage1?.response) {
        txtContent += `${cleaned.stage1.response}\n\n`;
    }

    txtContent += `=== ОТВЕТЫ ПОЛЬЗОВАТЕЛЯ ===\n`;
    if (cleaned.answers && Array.isArray(cleaned.answers)) {
        cleaned.answers.forEach((a: any, i: number) => {
            txtContent += `${i + 1}) ${a.question}\n   → ${a.answer}\n`;
        });
    }
    txtContent += `\n`;

    txtContent += `=== STAGE 2: ГЕНЕРАЦИЯ ===\n`;
    txtContent += cleaned.generatedFile || "(не сгенерирован)";
    txtContent += `\n`;

    await writeFile(txtPath, txtContent);

    console.log(`\n📝 Отладка сохранена:\n   JSON → ${jsonPath}\n   TXT  → ${txtPath}`);
};

// === ПАРСИНГ ВОПРОСОВ ИЗ ОТВЕТА LLM ===
function parseQuestions(response: string): string[] {
    const lines = response.split("\n");
    const questions: string[] = [];

    for (const line of lines) {
        const match = line.match(/^\d+\.\s*(.+)$/);
        if (match) {
            questions.push(match[1].trim());
        }
    }

    return questions;
}

// === MAIN ===
console.log("╔════════════════════════════════════════╗");
console.log("║   Kosmos Task Factory v1.0             ║");
console.log("║   Генератор .kosmos.md файлов          ║");
console.log("╚════════════════════════════════════════╝\n");

console.log("Опиши задачу одной фразой.\n");

const goal = prompt("Цель → ")?.trim() || "";
if (!goal) {
    console.log("Цель не указана. Выход.");
    process.exit(0);
}

console.log(`\n🎯 Цель: ${goal}\n`);

// === STAGE 1: Генерация вопросов ===
console.log("🔄 Генерирую уточняющие вопросы...\n");

const stage1Messages = [
    { role: "system" as const, content: QUESTIONS_PROMPT },
    { role: "user" as const, content: goal }
];

const questionsResponse = await callLLM(stage1Messages);
const questions = parseQuestions(questionsResponse);

if (questions.length === 0) {
    console.log("⚠️ LLM не сгенерировал вопросы. Переход к генерации без уточнений.\n");
}

// Вывод вопросов и сбор ответов
console.log("📋 Ответь на вопросы (Enter = пропустить):\n");

const answersData: { question: string; answer: string }[] = [];

for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`${i + 1}) ${q}`);
    const a = prompt("   → ")?.trim() || "[пропущено]";
    answersData.push({ question: q, answer: a });
}

// === STAGE 2: Генерация .kosmos.md ===
console.log("\n🔄 Генерирую .kosmos.md файл...\n");

// Формируем контекст с ответами
let answersContext = "";
if (answersData.length > 0) {
    answersContext = "\n\nУточнения от пользователя:\n";
    answersData.forEach((a, i) => {
        if (a.answer !== "[пропущено]") {
            answersContext += `${i + 1}. ${a.question}: ${a.answer}\n`;
        }
    });
}

// Добавляем текущую дату
const today = new Date().toISOString().split("T")[0];

const stage2Messages = [
    { role: "system" as const, content: GENERATOR_PROMPT },
    { role: "user" as const, content: `Цель: ${goal}${answersContext}\n\nТекущая дата: ${today}\n\nСгенерируй .kosmos.md файл.` }
];

const generatedFile = await callLLM(stage2Messages);

// === Сохранение файла ===
// Извлекаем название из первой строки (# Название .kosmos.md)
const titleMatch = generatedFile.match(/^#\s*(.+?)\s*\.kosmos\.md/m);
const fileName = titleMatch
    ? titleMatch[1].toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
    : `task-${Date.now()}`;

const outputPath = join(OUTPUT_DIR, `${fileName}.kosmos.md`);
await writeFile(outputPath, generatedFile);

console.log(`\n✅ Файл создан: ${outputPath}`);

// === Логирование ===
const debugLog = {
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

// === Предложение запустить ===
console.log("\n" + "─".repeat(50));
console.log("Для запуска выполните:");
console.log(`  node kosmos-runner-cli.js "${outputPath}"`);
console.log("─".repeat(50));

const runNow = prompt("\nЗапустить сейчас? (y/N) → ")?.trim().toLowerCase();
if (runNow === "y") {
    const { spawn } = await import("child_process");
    spawn("node", ["kosmos-runner-cli.js", outputPath], {
        cwd: join(ROOT, ".."),
        stdio: "inherit"
    });
}

console.log("\n🎉 Готово!");
