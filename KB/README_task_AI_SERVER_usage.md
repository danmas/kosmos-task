# Использование AI Server в проекте Kosmos Task

В этом документе детально описано, как именно проект `kosmos-task` использует AI Server. 
Это практическое дополнение к [инструкции по интеграции](./README_task_AI_MODEL_integration.md).

## 1. Обзор сценариев использования

В проекте AI используется для двух ключевых задач:
1.  **Task Factory**: Генерация структурированных задач (`.kosmos.md`) из короткой идеи пользователя. 
    *   *Паттерн*: "Интерактивное уточнение" (User Goal → AI Questions → User Answers → AI Generation).
2.  **Agent Factory**: Генерация кода новых AI-агентов на TypeScript.
    *   *Паттерн*: "Контракт" (Жесткий список вопросов → AI Code Generation).

---

### Полная реализация Клиента (Reference Implementation)

Ниже приведен готовый к использованию код клиента (`src/llm.ts`), включающий работу с историей и обработку ошибок.

**Основные интерфейсы:**
```typescript
type Message = { role: "system" | "user" | "assistant"; content: string };

interface HistoryEntry {
  timestamp: string;
  model: string;
  messages: Message[];
  response: string;
  error?: string;
}
```

**Работа с историей (Логирование):**
```typescript
import { join } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";

const HISTORY_FILE = join(process.cwd(), "history.json");

function saveHistory(entry: HistoryEntry) {
  let history: HistoryEntry[] = [];
  if (existsSync(HISTORY_FILE)) {
    try {
      history = JSON.parse(readFileSync(HISTORY_FILE, "utf-8"));
    } catch { /* ignore error */ }
  }
  history.push(entry);
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
}
```

**Основная функция вызова API (`callLLM`):**
```typescript
import { LLM_BASE_URL, LLM_API_KEY, LLM_MODEL } from "./env";

export async function callLLM(messages: Message[], model = LLM_MODEL): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (LLM_API_KEY) headers["Authorization"] = `Bearer ${LLM_API_KEY}`;

  const timestamp = new Date().toISOString();
  console.log(`📡 Connecting to LLM: ${LLM_BASE_URL} (${model})...`);

  try {
    const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, messages, temperature: 0.3 }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      // Проверка на HTML (частый признак ошибки прокси/сервера)
      if (errorText.includes("<!DOCTYPE html>") || errorText.includes("Cannot POST")) {
        console.warn("⚠️ LLM сервер недоступен. Использую MOCK-режим.");
        return getMockResponse(messages); // См. реализацию Mock ниже
      }
      saveHistory({ timestamp, model, messages, response: "", error: errorText });
      throw new Error(`LLM error ${res.status}: ${errorText.slice(0, 200)}...`);
    }

    const json = await res.json();
    const response = json.choices?.[0]?.message?.content || "";
    
    if (!response) throw new Error("Empty response from LLM");

    saveHistory({ timestamp, model, messages, response });
    return response;

  } catch (e: any) {
    // Обработка сетевых ошибок (conn refused)
    if (e.message.includes("fetch failed") || e.message.includes("ECONNREFUSED")) {
      console.warn("⚠️ Нет соединения с LLM. Использую MOCK-режим.");
      return getMockResponse(messages);
    }
    
    if (!e.message.startsWith("LLM error")) {
      saveHistory({ timestamp, model, messages, response: "", error: e.message });
    }
    throw e;
  }
}
```

---

## 3. Паттерн 1: Двухпроходная генерация (Task Factory)

Файл: `src/task-factory.ts`

Этот сценарий решает проблему "плохого промпта", заставляя AI сначала уточнить детали у пользователя.

### Шаг 1: Генерация вопросов
Система отправляет цель пользователя и просит AI сгенерировать список уточняющих вопросов.

```typescript
// 1. Формируем контекст
const stage1Messages = [
    { role: "system", content: QUESTIONS_PROMPT }, // Промпт: "Задай 5 вопросов..."
    { role: "user", content: goal }
];

// 2. Получаем вопросы
const questionsResponse = await callLLM(stage1Messages);
const questions = parseQuestions(questionsResponse); // Парсинг текста в массив

// 3. Задаем вопросы пользователю в консоли
for (let q of questions) {
   const answer = prompt(q);
   answersData.push({ question: q, answer });
}
```

### Шаг 2: Финальная генерация
Ответы пользователя собираются в один контекст и отправляются вместе с исходной целью для генерации финального документа.

```typescript
// 4. Формируем контекст с ответами
let answersContext = "Уточнения от пользователя:\n";
answersData.forEach(a => answersContext += `${a.question}: ${a.answer}\n`);

// 5. Генерируем итоговый файл
const stage2Messages = [
    { role: "system", content: GENERATOR_PROMPT }, // Промпт: "Сгенерируй .kosmos.md..."
    { role: "user", content: `Цель: ${goal}\n${answersContext}` }
];

const generatedFile = await callLLM(stage2Messages);
await writeFile(outputPath, generatedFile);
```

---

## 4. Паттерн 2: Генерация по контракту (Agent Factory)

Файл: `src/factory.ts`

Здесь, вместо генерации вопросов на лету, используется жестко заданный список вопросов ("Контракт"). Это гарантирует, что AI получит нужные метаданные (фильтры файлов, путь к логгеру и т.д.).

```typescript
// 1. Жесткий список вопросов
const QUESTIONS = [
    "Какие файлы обрабатывать?",
    "Путь к логгеру?",
    // ...
];

// 2. Сбор ответов (без участия LLM на этом этапе!)
const answers = collectAnswers(QUESTIONS);

// 3. Единственный вызов LLM
const stage1Messages = [
    { role: "system", content: GENERATOR_PROMPT },
    { role: "user", content: goal },
    { role: "user", content: `Ответы: ${answers.join('\n')} \n\nСоздай код.` }
];

const code = await callLLM(stage1Messages);
```

---

## 5. Mocking (Заглушки)

Для разработки без GPU/AI реализована система заглушек в `src/llm.ts`.

Если `fetch` падает с ошибкой сети или сервер возвращает HTML (ошибку прокси), вызывается `getMockResponse(messages)`. Он анализирует содержимое `system` промпта, чтобы понять, какой сценарий эмулировать.

**Пример логики Mock:**
```typescript
function getMockResponse(messages: Message[]): string {
  const lastSysMsg = messages.find(m => m.role === "system")?.content || "";

  // Если промпт содержит просьбу задать вопросы (Task Factory Stage 1)
  if (lastSysMsg.includes("QUESTIONS:")) {
    return "1. Какая ОС?\n2. Какой порт?";
  }
  
  // Если промпт просит сгенерировать код (Agent Factory)
  if (lastSysMsg.includes("class Agent")) {
     return "import ... export class MyAgent { ... }";
  }

  return "Mock error: unknown scenario";
}
```

---

## 6. Отладка и Логирование

Проект сохраняет **полный контекст** взаимодействия для отладки промптов.

1.  **History.json**: Накопительный лог всех запросов к `llm.ts`. Помогает понять, что именно ушло на сервер.
2.  **Debug Logs** (`logs/factory-debug-*.json`): Фабрики сохраняют промежуточные состояния (цель, вопросы, ответы, финальный промпт) в отдельные файлы. Это позволяет воспроизвести генерацию без повторного ввода данных.

**Пример структуры лога фабрики:**
```json
{
  "goal": "Создать SQL миграцию",
  "stage1": { "response": "1. Какая таблица?..." },
  "answers": [ { "question": "...", "answer": "Users" } ],
  "generatedFile": "# Migration..."
}
```
