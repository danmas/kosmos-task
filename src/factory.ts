// src/factory.ts — v1.0 — контракт зафиксирован в коде
import { callLLM } from "../llm.ts";
import { $ } from "bun";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const ROOT = import.meta.dir + "/..";
const AGENTS_DIR = join(ROOT, "agents");
const PROMPTS_DIR = join(ROOT, "prompts");
const LOGS_DIR = join(ROOT, "logs");
await mkdir(LOGS_DIR, { recursive: true });

const GENERATOR_PROMPT = await readFile(join(PROMPTS_DIR, "factory-generator-v1.md"), "utf-8");

// === УТИЛИТЫ ДЛЯ КРАСИВЫХ ЛОГОВ ===
const clean = (obj: any): any => {
    if (typeof obj === "string") {
        return obj
            // Убираем null-символы (повреждённая кодировка)
            .replace(/\u0000/g, "")
            // Убираем Windows CRLF → LF
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "")
            // Разворачиваем литеральные escape-последовательности (если пришли как текст)
            .replace(/\\r\\n/g, "\n")
            .replace(/\\n/g, "\n")
            .replace(/\\t/g, "\t")
            .replace(/\\"/g, '"')
            // Убираем множественные пустые строки
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
    const jsonPath = join(LOGS_DIR, `factory-debug-${ts}${suffix}.json`);
    const txtPath = join(LOGS_DIR, `factory-debug-${ts}${suffix}.txt`);

    const cleaned = clean(JSON.parse(JSON.stringify(data))); // глубокая очистка

    await writeFile(jsonPath, JSON.stringify(cleaned, null, 2));

    // Формируем TXT с безопасной обработкой массивов
    let txtContent = `=== KOSMOS AGENT FACTORY DEBUG LOG ===\n`;
    txtContent += `Время: ${new Date().toLocaleString("ru-RU")}\n`;
    txtContent += `Цель: ${cleaned.goal}\n\n`;

    txtContent += `=== ВОПРОСЫ И ОТВЕТЫ ===\n`;
    if (cleaned.questions && Array.isArray(cleaned.questions)) {
        cleaned.questions.forEach((q: any, i: number) => {
            txtContent += `${i + 1}) ${q.question}\n   → ${q.answer}\n`;
        });
    }
    txtContent += `\n`;

    txtContent += `=== STAGE 1: PROMPT → LLM ===\n`;
    if (cleaned.stage1 && Array.isArray(cleaned.stage1.messages)) {
        cleaned.stage1.messages.forEach((m: any) => {
            txtContent += `[${m.role.toUpperCase()}]:\n${m.content}\n\n`;
        });
    }
    if (cleaned.stage1?.response) {
        txtContent += `[RESPONSE]:\n${cleaned.stage1.response}\n\n`;
    }

    txtContent += `=== GENERATED CODE ===\n`;
    txtContent += cleaned.generatedCode || "(не извлечён)";
    txtContent += `\n`;

    await writeFile(txtPath, txtContent);

    console.log(`\n📝 Отладка сохранена:\n   JSON → ${jsonPath}\n   TXT  → ${txtPath}`);
};

// === ЖЁСТКО ЗАФИКСИРОВАННЫЕ ВОПРОСЫ ===
const QUESTIONS = [
    "Какие файлы обрабатывать? (пример: .ts, .js/.ts, все кроме node_modules)",
    "Путь к логгеру (если нужен)? (пример: src/utils/logger.ts, иначе пусто)",
    "Делать автокоммит + push в конце? (да / нет, по умолчанию нет)",
    "Режим применения изменений? (авто / diff, по умолчанию авто)",
    "Дополнительные пожелания? (опционально)",
] as const;

console.log("Kosmos Agent Factory v1.0 — контракт зафиксирован");
console.log("Опиши задачу одной фразой.\n");

const goal = prompt("Цель → ")?.trim() || "";
if (!goal) process.exit(0);

console.log(`\nЦель: ${goal}\n`);
console.log("Ответь на вопросы (Enter = дефолт):\n");

const answers: string[] = [];
for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    const a = prompt(`${i + 1}) ${q}\n   → `)?.trim();
    answers.push(a || "[дефолт]");
}

// Нормализация дефолтов
const norm = (idx: number, def: string) => answers[idx] === "[дефолт]" ? def : answers[idx];
const filesFilter = norm(0, "все файлы");
const loggerPath = norm(1, "").trim();
const autocommit = norm(2, "нет") === "да";
const mode = norm(3, "авто") === "diff" ? "diff" : "авто";
const extra = norm(4, "");

// === Сбор данных для логирования ===
const questionsData = QUESTIONS.map((q, i) => ({
    question: q,
    answer: answers[i]
}));

const stage1Messages = [
    { role: "system" as const, content: GENERATOR_PROMPT },
    { role: "user" as const, content: goal },
    { role: "user" as const, content: `Ответы:\n1. ${filesFilter}\n2. ${loggerPath}\n3. ${autocommit}\n4. ${mode}\n5. ${extra}\n\nСоздай код.` }
];

// === Генерация кода ===
console.log("\nГенерирую агента...");
const response = await callLLM(stage1Messages);

const code = response.match(/```ts\n([\s\S]*?)\n```/)?.[1] || response;

// === Логирование запросов (красивое) ===
const debugLog = {
    timestamp: new Date().toISOString(),
    goal,
    questions: questionsData,
    stage1: {
        messages: stage1Messages,
        response: response
    },
    generatedCode: code
};

await saveDebugLog(debugLog);

// === Сохранение и запуск ===
const agentName = `agent-${Date.now()}-${randomWord()}.ts`;
const agentPath = join(AGENTS_DIR, agentName);
await writeFile(agentPath, code);

console.log(`\nАгент рождён → ${agentName}`);

const confirm = prompt("\nЗАПУСТИТЬ? (y/N) → ")?.trim().toLowerCase();
if (confirm !== "y") {
    console.log("Отменено. Запусти вручную: bun run", agentPath);
    process.exit(0);
}

const logPath = join(LOGS_DIR, agentName + ".log");
await $`bun run ${agentPath}`.env({ ...process.env, KOSMOS_AGENT_LOG: logPath });

console.log("\nГотово!");

// utils
function randomWord() {
    return ["nova", "cosmo", "quark", "pulse", "orbit", "nebula", "flare", "void", "apex", "zenith"][Math.random() * 10 | 0];
}