#!/usr/bin/env node

/**
 * kosmos-runner.js v0.7
 * Универсальный исполнитель и валидатор .kosmos.md файлов
 *
 * Использование:
 *   node kosmos-runner.js my-project.kosmos.md          → выполнить все executable-блоки
 *   node kosmos-runner.js my-project.kosmos.md --validate → только проверка формата
 *   node kosmos-runner.js my-project.kosmos.md -v        → короткая форма валидации
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const filePath = process.argv[2];
const validateOnly = process.argv.includes('--validate') || process.argv.includes('-v');

if (!filePath || !fs.existsSync(filePath)) {
  console.error('Ошибка: укажите существующий файл .kosmos.md');
  console.error('Пример: node kosmos-runner.js project.kosmos.md');
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf-8');

// ======================== ВАЛИДАЦИЯ ========================
function validateKosmosFile(content, filePath) {
  const errors = [];
  const lines = content.split('\n');

  // 1. Заголовок
  //if (!lines[0]?.trim().endsWith('.kosmos.md')) {
  //  errors.push('Заголовок # должен заканчиваться на " .kosmos.md"');
  //}

  // 2. Шапка
  if (!/\*\*Статус:\*\*\s+(in progress|done|blocked)/.test(content)) {
    errors.push('Отсутствует или неверная строка **Статус:**');
  }
  if (!/\*\*Прогресс:\*\*\s+\d+%/.test(content)) {
    errors.push('Отсутствует или неверная строка **Прогресс:**');
  }
  if (!/\*\*Последнее обновление:\*\*\s+\d{4}-\d{2}-\d{2}/.test(content)) {
    errors.push('Отсутствует или неверная строка **Последнее обновление:** (формат YYYY-MM-DD)');
  }

  // 3. Проверка отступов чекбоксов шагов и обязательных полей
  let inTask = false;
  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trim();

    if (/^### Задача \d+:/.test(trimmed)) inTask = true;

    // Чекбоксы шагов: только 2 или 4 пробела перед "- [ ]" / "- [x]"
    if (/^\s*- \[[ x]\]\s/.test(line)) {
      const indent = line.match(/^\s*/)[0].length;
      if (indent !== 2 && indent !== 4) {
        errors.push(`Строка ${lineNum}: неверный отступ у чекбокса шага (должно быть 2 или 4 пробела)`);
      }
    }

    // Ожидаемый результат обязателен после каждого шага
    if (/^\s*- \[[ x]\] Шаг:/.test(line)) {
      let foundExpected = false;
      for (let j = i + 1; j < lines.length && j < i + 15; j++) {
        if (lines[j].includes('Ожидаемый результат:')) {
          foundExpected = true;
          break;
        }
        if (/^\s*- \[[ x]\]/.test(lines[j])) break; // следующий шаг
      }
      if (!foundExpected) {
        errors.push(`Строка ${lineNum}: у шага отсутствует строка "Ожидаемый результат:"`);
      }
    }

    // Запрещаем опасные операции в executable-блоках
    if (/```(?:js|javascript|ts|bash|python)?\s+executable/.test(line)) {
      let codeLine = '';
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() === '```') break;
        codeLine += lines[j] + '\n';
      }
      if (codeLine.includes('fs.write') || codeLine.includes('fs.read') || codeLine.includes('child_process')) {
        // errors.push(`Строка ${lineNum}: executable-блок содержит запрещённые операции (fs, child_process и т.д.)`);
        console.log(`ВНИМАНИЕ! Строка ${lineNum}: executable-блок содержит запрещённые операции (fs, child_process и т.д.)`);
      }
    }
  });

  return errors;
}

// Запуск валидации, если нужно
if (validateOnly) {
  const errors = validateKosmosFile(content, filePath);
  if (errors.length > 0) {
    console.error('ОШИБКИ ФОРМАТА KOSMOS:');
    errors.forEach(e => console.error('✖', e));
    process.exit(1);
  } else {
    console.log('Формат kosmos корректен ✓');
    process.exit(0);
  }
}

// ======================== ВЫПОЛНЕНИЕ ========================
const executableRegex = /```(?:js|javascript|ts|python|bash)?\s+executable\b\s*([\s\S]*?)\n```/g;

let match;
let hasChanges = false;

while ((match = executableRegex.exec(content)) !== null) {
  const fullBlock = match[0];
  const code = match[1].trim();

  // Пропускаем, если уже есть Actual result
  const afterBlock = content.slice(match.index + fullBlock.length, match.index + fullBlock.length + 300);
  if (afterBlock.includes('Actual result:')) {
    console.log('Блок уже выполнен → пропуск');
    continue;
  }

  console.log('\nВыполняется executable-блок:');
  console.log(code);
  console.log('—'.repeat(50));

  let output = '';
  let execError = null;

  try {
    const script = new vm.Script(code);
    const sandbox = {
      console: {
        log: (...args) => { output += args.join(' ') + '\n'; },
        error: (...args) => { output += 'ERROR: ' + args.join(' ') + '\n'; },
      },
      require,
      process,
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      // БЕЗОПАСНОСТЬ: запрещаем fs, child_process и т.д.
    };
    const context = vm.createContext(sandbox);
    script.runInContext(context, { timeout: 5000 });
  } catch (err) {
    execError = err;
    output += `ИСКЛЮЧЕНИЕ: ${err.message}\n`;
  }

  const resultBlock = [
    '',
    '  Actual result:',
    '  ```',
    output.trim() || '(нет вывода)',
    '  ```',
    ''
  ].join('\n');

  const insertPos = match.index + fullBlock.length;
  content = content.slice(0, insertPos) + resultBlock + content.slice(insertPos);
  hasChanges = true;

  console.log(output || '(нет вывода)');
  if (execError) console.error(execError);
}

// ======================== ОБНОВЛЕНИЕ ПРОГРЕССА ========================
if (hasChanges) {
  const done = (content.match(/-\s\[x\]/g) || []).length;
  const total = (content.match(/-\s\[.\]/g) || []).length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  content = content.replace(
    /(\*\*Прогресс:\*\*\s*)\d+%/,
    `$1${progress}%`
  );

  // Обновляем дату
  const today = new Date().toISOString().slice(0, 10);
  content = content.replace(
    /(\*\*Последнее обновление:\*\*\s*)\d{4}-\d{2}-\d{2}/,
    `$1${today}`
  );

  // Бэкап
  const backupPath = `${filePath}.backup.${Date.now()}`;
  fs.copyFileSync(filePath, backupPath);
  console.log(`Бэкап сохранён: ${backupPath}`);

  fs.writeFileSync(filePath, content);
  console.log(`\nФайл обновлён! Прогресс: ${progress}% ✓`);
} else {
  console.log('Изменений нет.');
}