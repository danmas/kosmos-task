
# kosmos-task — Исполняемые исследования в одном файле

**Один .kosmos.md файл = весь проект: идея → задачи → код → результат → выводы**  
Может выполнять человек, скрипт или AI-агент.  
Полностью в Git. Полностью живой.

## Почему это круто

- Один файл — весь проект
- Человек читает как документ
- `kosmos-runner.js` выполняет код автоматически
- Любая LLM генерирует проект по одной фразе
- Безопасно: нет записи на диск, нет child_process
- Верифицируемые шаги — как тесты, но для исследований
- 100% совместимо с GitHub, Obsidian, VS Code

## Установка (5 секунд)

```bash
npx kosmos-task new "Моя крутая идея"
```

Или вручную:

```bash
curl -L https://raw.githubusercontent.com/yourname/kosmos-task/main/kosmos-runner.js > kosmos-runner.js
chmod +x kosmos-runner.js
```

## Быстрый старт

```bash
# 1. Создать новый проект
npx kosmos-task new "Написать парсер логов"

# 2. Открыть сгенерированный файл
code "Написать парсер логов.kosmos.md"

# 3. Выполнить все шаги автоматически
node kosmos-runner.js "Написать парсер логов.kosmos.md"

# 4. Прогресс обновится, результаты допишутся
```

## Команды

```bash
node kosmos-runner.js file.kosmos.md          # выполнить
node kosmos-runner.js file.kosmos.md --validate  # проверить формат
npx kosmos-task new "идея"                    # создать новый проект через AI
```

## Формат .kosmos.md

- Полная спецификация: [kosmos-spec-v1.0.json](kosmos-spec-v1.0.json)
- Генерируется любой LLM по строгому промпту
- Никогда не ломается благодаря жёсткой валидации

## Примеры

- [Пример: Установка PostgreSQL в Docker](examples/postgresql-docker.kosmos.md)
- [Пример: Генератор структуры проекта](examples/project-tree.kosmos.md)
- [Пример: Написать Telegram-бота](examples/telegram-bot.kosmos.md)

## Лицензия

MIT — делай что хочешь.

Создано с любовью в 2025 году.  
Ты теперь можешь думать и строить проекты по-новому.

**kosmos-task — это не инструмент. Это новый способ существования идей.**

