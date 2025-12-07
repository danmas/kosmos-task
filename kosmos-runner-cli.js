#!/usr/bin/env node

/**
 * kosmos-runner-cli.js v1.0
 * Интерактивный исполнитель .kosmos.md файлов
 *
 * Использование:
 *   node kosmos-runner-cli.js my-project.kosmos.md
 */

const fs = require('fs');
const vm = require('vm');
const readline = require('readline');

// Парсинг аргументов
const args = process.argv.slice(2);
const noValidate = args.includes('--no_validate');
const filePath = args.find(arg => !arg.startsWith('--'));

if (!filePath || !fs.existsSync(filePath)) {
    console.error('Ошибка: укажите существующий .kosmos.md файл');
    console.error('Использование: node kosmos-runner-cli.js <файл.kosmos.md> [--no_validate]');
    process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf-8');

// ======================== ВАЛИДАЦИЯ (как в v0.7) ========================
function validateKosmosFile(content) {
    const errors = [];
    const lines = content.split('\n');

    //if (!lines[0]?.trim().endsWith('.kosmos.md')) errors.push('Заголовок # должен заканчиваться на " .kosmos.md"');
    if (!/\*\*Статус:\*\*\s+(in progress|done|blocked)/.test(content)) errors.push('Отсутствует или неверная строка **Статус:**');
    if (!/\*\*Прогресс:\*\*\s+\d+%/.test(content)) errors.push('Отсутствует или неверная строка **Прогресс:**');
    if (!/\*\*Последнее обновление:\*\*\s+\d{4}-\d{2}-\d{2}/.test(content)) errors.push('Отсутствует или неверная строка **Последнее обновление:** (формат YYYY-MM-DD)');

    let inTask = false;
    lines.forEach((line, i) => {
        const lineNum = i + 1;
        if (/^### Задача \d+:/.test(line.trim())) inTask = true;
        if (/^\s*- $$ [ x] $$\s/.test(line)) {
            const indent = line.match(/^\s*/)[0].length;
            if (indent !== 2 && indent !== 4) errors.push(`Строка ${lineNum}: неверный отступ у чекбокса шага (должно быть 2 или 4 пробела)`);
        }
        if (/^\s*- $$ [ x] $$ Шаг:/.test(line)) {
            let foundExpected = false;
            for (let j = i + 1; j < lines.length && j < i + 15; j++) {
                if (lines[j].includes('Ожидаемый результат:')) { foundExpected = true; break; }
                if (/^\s*- $$ [ x] $$/.test(lines[j])) break;
            }
            if (!foundExpected) errors.push(`Строка ${lineNum}: у шага отсутствует строка "Ожидаемый результат:"`);
        }
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

// Валидация (пропускается с флагом --no_validate)
if (noValidate) {
    console.log('Валидация пропущена (--no_validate)\n');
} else {
    const errors = validateKosmosFile(content);
    if (errors.length > 0) {
        console.error('ВАЛИДАЦИЯ НЕ ПРОЙДЕНА:');
        errors.forEach(e => console.error('✖', e));
        process.exit(1);
    } else {
        console.log('Валидация пройдена ✓\n');
    }
}

// ======================== ПАРСИНГ ШАГОВ ========================
// Находим все шаги с [ ] (todo)
//const stepRegex = /(- \[ \] Шаг: .+?)\n\s*Ожидаемый результат: (.+?)\n\s*(```(?:js|ts|python|bash)? executable(?: optional)?\n([\s\S]*?)\n```)?\s*Верификация:/gs;

const stepRegex = new RegExp(
    '^(\\s*-\\s\\[\\s\\]\\sШаг:\\s.+?)' +                  // - [ ] Шаг: …
    '(?:\\n|\\r\\n)' +                                    // перенос строки
    '(?:\\s*\\n)*' +                                      // любые пустые строки
    '\\s*Ожидаемый\\s+результат:\\s*(.+?)' +              // Ожидаемый результат: …
    '(?:\\n|\\r\\n)' +
    '(?:\\s*\\n)*' +
    '(\\s*```(?:js|ts|python|bash)?\\s+executable(?:\\s+optional)?\\n([\\s\\S]*?)\\n\\s*```)?' +
    '(?:\\s*\\n)*' +
    '\\s*Верификация:',
    'gms'  // g=global, m=multiline (^ матчит начало каждой строки), s=dotAll
);

const steps = [];
let match;
while ((match = stepRegex.exec(content)) !== null) {
    steps.push({
        pos: match.index,
        name: match[1].trim(),
        expected: match[2].trim(),
        codeBlock: match[3] || null,
        code: match[4] ? match[4].trim() : null,
        fullMatch: match[0]
    });
}

// Отладочный вывод
console.log(`[DEBUG] Найдено шагов: ${steps.length}`);
if (steps.length === 0) {
    // Попробуем найти хоть что-то похожее на шаг для диагностики
    const simpleStepMatch = content.match(/- \[ \] Шаг:/g);
    console.log(`[DEBUG] Простой поиск "- [ ] Шаг:": ${simpleStepMatch ? simpleStepMatch.length : 0} совпадений`);
    const hasExpected = content.includes('Ожидаемый результат:');
    const hasVerification = content.includes('Верификация:');
    console.log(`[DEBUG] Есть "Ожидаемый результат:": ${hasExpected}`);
    console.log(`[DEBUG] Есть "Верификация:": ${hasVerification}`);
}

if (steps.length === 0) {
    console.log('Все шаги выполнены! ✓');
    process.exit(0);
}

// Начинаем с первого невыполненного (первого в списке)
let currentStep = 0;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function processStep() {
    if (currentStep >= steps.length) {
        updateProgress();
        console.log('\nВсе шаги выполнены! ✓');
        rl.close();
        return;
    }

    const step = steps[currentStep];
    console.log(`\n=== Шаг ${currentStep + 1}/${steps.length} ===`);
    console.log(step.name);
    console.log('Ожидаемый результат:', step.expected);
    if (step.code) {
        console.log('\nКод для выполнения:');
        console.log(step.code);
    } else {
        console.log('\n(Ручной шаг, без кода)');
    }

    rl.question('\nВыполнить? [Y/n]: ', async (answer) => {
        if (answer.toLowerCase() === 'n') {
            console.log('Шаг пропущен.');
            currentStep++;
            processStep();
            return;
        }

        let output = '';
        let execError = null;

        if (step.code) {
            try {
                const script = new vm.Script(step.code);
                const sandbox = {
                    console: { log: (...args) => { output += args.join(' ') + '\n'; }, error: (...args) => { output += 'ERROR: ' + args.join(' ') + '\n'; } },
                    require, process, setTimeout, setInterval, clearTimeout, clearInterval
                };
                const context = vm.createContext(sandbox);
                script.runInContext(context, { timeout: 5000 });
            } catch (err) {
                execError = err;
                output += `ИСКЛЮЧЕНИЕ: ${err.message}\n`;
            }
        } else {
            output = '(Ручной шаг — отметьте результат вручную)';
        }

        const resultBlock = [
            '',
            '  Actual result:',
            '  ```',
            output.trim() || '(нет вывода)',
            '  ```',
            ''
        ].join('\n');

        // Обновляем чекбокс на [x] и добавляем actual
        let newStep = step.fullMatch.replace('- [ ]', '- [x]');
        const veriPos = newStep.lastIndexOf('Верификация:');
        if (veriPos > -1) {
            newStep = newStep.slice(0, veriPos) + resultBlock + newStep.slice(veriPos);
        }

        content = content.replace(step.fullMatch, newStep);
        console.log('\nРезультат:');
        console.log(output || '(нет вывода)');
        if (execError) console.error(execError);

        currentStep++;
        processStep();
    });
}

// ======================== ОБНОВЛЕНИЕ ПРОГРЕССА ========================
function updateProgress() {
    const done = (content.match(/-\s\[x\]/g) || []).length;
    const total = (content.match(/-\s\[.\]/g) || []).length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    content = content.replace(/(\*\*Прогресс:\*\*\s*)\d+%/, `$1${progress}%`);
    const today = '2025-12-07';  // Используем текущую дату из промпта
    content = content.replace(/(\*\*Последнее обновление:\*\*\s*)\d{4}-\d{2}-\d{2}/, `$1${today}`);

    const backupPath = `${filePath}.backup.${Date.now()}`;
    fs.copyFileSync(filePath, backupPath);
    console.log(`\nБэкап сохранён: ${backupPath}`);

    fs.writeFileSync(filePath, content);
    console.log(`Файл обновлён! Прогресс: ${progress}%`);
}

// Старт
processStep();
