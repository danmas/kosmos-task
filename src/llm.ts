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
    console.log(`📡 Connecting to LLM: ${LLM_BASE_URL} (${model})...`);

    // --- MOCK MODE CHECK (if URL includes 'localhost:3002' and likely fails) ---
    // Для демо-целей, если сервер явно "сломан" (возвращает HTML 404), переключаемся на мок.

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
      // Если это HTML от Express (Cannot POST...), считаем, что API недоступен
      if (errorText.includes("<!DOCTYPE html>") || errorText.includes("Cannot POST")) {
        console.warn("⚠️ LLM сервер недоступен или не настроен. Mock-режим доступен только для отладки (MOCK=1).");
        if (process.env.MOCK === '1') return getMockResponse(messages);
        throw new Error(`LLM сервер недоступен: ${errorText.slice(0, 100)}`);
      }

      saveHistory({ timestamp, model, messages, response: "", error: errorText });
      throw new Error(`LLM error ${res.status}: ${errorText.slice(0, 200)}...`);
    }

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON response: ${text.slice(0, 100)}...`);
    }

    const response = json.choices?.[0]?.message?.content || "";
    if (!response) throw new Error("Empty response from LLM");

    saveHistory({ timestamp, model, messages, response });

    return response;

  } catch (e: any) {
    // Если "fetch failed" (нет соединения), фоллбэк на мок ТОЛЬКО для отладки
    if (e.message.includes("fetch failed") || e.message.includes("ECONNREFUSED")) {
      console.warn("⚠️ Нет соединения с LLM сервером. Mock-режим доступен только для отладки (MOCK=1).");
      if (process.env.MOCK === '1') return getMockResponse(messages);
      throw new Error(`Нет соединения с LLM сервером: ${e.message}`);
    }

    if (!e.message.startsWith("LLM error")) {
      saveHistory({ timestamp, model, messages, response: "", error: e.message });
    }
    throw e;
  }
}

// === MOCK RESPONSES FOR DEMO ===
function getMockResponse(messages: Message[]): string {
  const lastUserMessage = messages[messages.length - 1].content.toLowerCase();

  // 1. Если это запрос на вопросы (Stage 1)
  if (messages.some(m => m.role === "system" && m.content.includes("QUESTIONS:"))) {
    return `QUESTIONS:
1. Какая операционная система на целевом сервере? (по умолчанию Ubuntu)
2. Нужно ли настраивать персистентность данных (volumes)?
3. Какой порт пробросить для базы данных? (5432)
4. Нужен ли веб-интерфейс (pgAdmin)?
5. Требуется ли создание начальной базы данных и пользователя?`;
  }

  // 2. Если это запрос на генерацию (Stage 2)
  if (messages.some(m => m.role === "system" && m.content.includes("ВЫВОДИ ТОЛЬКО ГОТОВЫЙ ФАЙЛ"))) {
    return `# PostgreSQL Docker Setup .kosmos.md

**Статус:** in progress
**Прогресс:** 0%
**Последнее обновление:** ${new Date().toISOString().split('T')[0]}

## Краткое summary (пишется в конце)

(пусто)

## Цель

Развернуть PosgreSQL в Docker Compose на Ubuntu 24 с проверкой подключения.

## Задача 1: Подготовка окружения

### Шаг 1: Проверка Docker
- [ ] Выполнено
 \`\`\`bash executable
 docker --version && docker compose version
\`\`\`
Ожидаемый результат: Вывод версий Docker и Docker Compose

Результат:
(пусто)

Верификация:
- [ ] пройдена.

### Шаг 2: Создание docker-compose.yml
- [ ] Выполнено
 \`\`\`bash executable
 echo 'version: "3.8"
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: mydb
    ports:
      - "5432:5432"
    volumes:
      - ./pgdata:/var/lib/postgresql/data
' > docker-compose.yml
\`\`\`
Ожидаемый результат: Файл docker-compose.yml создан

Результат:
(пусто)

Верификация:
- [ ] пройдена.

## Задача 2: Запуск и проверка

### Шаг 1: Запуск контейнера
- [ ] Выполнено
 \`\`\`bash executable
 docker compose up -d
\`\`\`
Ожидаемый результат: Контейнер запущен (state Up)

Результат:
(пусто)

Верификация:
- [ ] пройдена.

### Шаг 2: Проверка подключения
- [ ] Выполнено
 \`\`\`bash executable
 docker compose exec db psql -U user -d mydb -c "SELECT 1;"
\`\`\`
Ожидаемый результат: Вывод "1 row" (успешное подключение)

Результат:
(пусто)

Верификация:
- [ ] пройдена.`;
  }

  return "Error: Unknown mock scenario";
}
