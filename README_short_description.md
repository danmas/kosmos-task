# kosmos-task — Исполняемые исследования в одном файле

**Один .kosmos.md файл = весь проект: идея → задачи → код → результат → выводы**  
Может выполнять человек, скрипт или AI-агент.  
Полностью в Git. Полностью живой.

---

## Быстрый старт

### Вариант A — Вручную

Создай файл `my-task.kosmos.md` со структурой: цель, задачи, шаги с исполняемым кодом.

**Пример:**

```markdown
# Мой первый проект .kosmos.md

**Статус:** in progress
**Прогресс:** 0%
**Последнее обновление:** 2026-06-30

## Цель
Проверить, как формат работает — вывести текст и посчитать числа.

## Задача 1: Приветствие и математика

### Шаг 1: Вывести приветствие
- [ ] Выполнено
 ```js executable
      console.log("Привет, Kosmos!");
```
Ожидаемый результат: Появится сообщение "Привет, Kosmos!"

Результат:
(пусто)

Верификация:
- [ ] пройдена.
```

### Вариант B — Через фабрику

```bash
bun run factory
```

Опиши цель одной фразой (например: *«Создать калькулятор Fibonacci»*), ответь на 3–5 уточняющих вопросов.
Фабрика сама сгенерирует готовый `.kosmos.md` в папку `data/`.

### Запуск файла

```bash
bun kosmos-runner-cli.js my-task.kosmos.md
```

Runner выполнит каждый `js executable` блок в sandbox, впишет результат и статус верификации прямо в файл,
обновит прогресс и дату. Готово — у тебя живой исполняемый документ.

> Также поддерживается Node.js: `bun run start:node` / `bun run server:node`

---

## Команды

| Команда | Назначение |
|---|---|
| `bun install` | Установить зависимости |
| `bun kosmos-runner-cli.js file.kosmos.md` | Запуск living document |
| `bun kosmos-runner-cli.js file.kosmos.md --no_validate` | Запуск без валидации |
| `bun run server` | REST API сервер |
| `bun run dev` | Сервер с watch-режимом |
| `bun run factory` | Task Factory (генерация .kosmos.md через LLM) |

---

## Формат .kosmos.md v2.0

### Ключевые элементы

| Элемент | Формат |
|---------|--------|
| Задача | `## Задача N: Название` |
| Шаг | `### Шаг N: Название` |
| Статус шага | `- [ ] Выполнено` / `- [x] Выполнено` |
| Код | `` ```lang executable `` (пробел перед `executable`) |
| Ожидаемый результат | `Ожидаемый результат: текст` |
| Результат | `Результат:\n(пусто)` |
| Верификация | `- [ ] пройдена.` |

**Ограничения:**
- Исполняемый код — только в блоках `` ```js executable ``
- Запрещено в executable-блоках: `fs.writeFile`, `mkdir`, `child_process`
- Поддерживаемый язык: JavaScript (sandbox через `vm`)

---

## Фабрики

### Task Factory — генерация .kosmos.md

**Запуск:** `bun run factory`  
**Код:** `src/task-factory.ts`

**Двухпроходная схема:**

1. **Уточняющие вопросы** — пользователь описывает цель одной фразой, LLM генерирует 3–5 коротких вопросов по контексту задачи (промпт: `prompts/task-factory-questions.md`). Пользователь отвечает или пропускает (Enter).
2. **Генерация файла** — ответы подшиваются в контекст, LLM по строгим правилам (`prompts/task-factory-generator.md`) возвращает чистый `.kosmos.md` без обёртки и пояснений. Файл сохраняется в `data/<имя>.kosmos.md`.

**Fallback:** если LLM недоступен (`ECONNREFUSED`, HTML 404), `src/llm.ts` автоматически переключается в mock-режим с захардкоженным ответом.

**Логирование:** каждый запуск пишет `task-factory-debug-<ts>.json` и `.txt` в `logs/`.

### Agent Factory — генерация агентов-скриптов

**Код:** `src/factory.ts`

Генерирует TypeScript-скрипты (агенты), которые делают изменения в коде проекта.

- 5 жёстко зафиксированных вопросов: какие файлы обрабатывать, путь к логгеру, автокоммит, режим (авто/diff), доп. пожелания
- Промпт-генератор: `prompts/factory-generator-v1.md`
- На выходе — `.ts` файл в папке `agents/`, запускается через `bun run`
- Два режима: **авто** (применить изменения) и **diff** (только показать diff)

### LLM-слой

**Код:** `src/llm.ts`

Общий для обеих фабрик. Конфиг из `.env`: `LLM_SERVER_URL`, `LLM_MODEL`, `LLM_API_KEY`. OpenAI-совместимый endpoint (`/chat/completions`). `temperature: 0.3` для стабильности генерации. Вся история запросов сохраняется в `history.json`.

---

## Спецификация

- [kosmos-spec-v1.0.json](specification/kosmos-spec-v1.0.json) — JSON со system prompt для LLM
- [kosmos-spec-v1.0.yaml](specification/kosmos-spec-v1.0.yaml) — YAML версия с примером

## Структура проекта

```
kosmos-task/
├── kosmos-runner-cli.js      # Интерактивный исполнитель v2.0
├── server/                   # REST API сервер
│   ├── index.js              # Точка входа
│   ├── routes/               # API роуты
│   ├── services/             # Бизнес-логика
│   └── utils/                # Утилиты
├── src/                      # TypeScript: фабрики и LLM
│   ├── task-factory.ts       # Task Factory
│   ├── factory.ts            # Agent Factory
│   ├── llm.ts                # LLM-слой
│   └── env.ts                # Конфигурация окружения
├── specification/
│   ├── kosmos-spec-v1.0.json # System prompt для LLM
│   └── kosmos-spec-v1.0.yaml # YAML версия
├── prompts/                  # Промпты для фабрик
├── data/                     # Сгенерированные .kosmos.md
├── bunfig.toml               # Конфигурация Bun
└── test-example.kosmos.md    # Тестовый файл
```

## Окружение

- **Рантайм:** [Bun](https://bun.sh) v1+ (рекомендуется) или Node.js 18+
- **LLM:** настраивается через `.env` (`LLM_SERVER_URL`, `LLM_MODEL`, `LLM_API_KEY`)

## Лицензия

MIT — делай что хочешь.

**kosmos-task — это не инструмент. Это новый способ существования идей.**
