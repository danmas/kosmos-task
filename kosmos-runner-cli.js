#!/usr/bin/env node

/**
 * kosmos-runner-cli.js v2.0
 * Упрощённый исполнитель .kosmos.md файлов
 *
 * Использование:
 *   node kosmos-runner-cli.js <файл.kosmos.md> [--no_validate]
 */

const fs = require('fs');
const vm = require('vm');
const readline = require('readline');

// ======================== ПАРСИНГ АРГУМЕНТОВ ========================
const args = process.argv.slice(2);
const noValidate = args.includes('--no_validate');
const filePath = args.find(arg => !arg.startsWith('--'));

if (!filePath || !fs.existsSync(filePath)) {
    console.error('Ошибка: укажите существующий .kosmos.md файл');
    console.error('Использование: node kosmos-runner-cli.js <файл.kosmos.md> [--no_validate]');
    process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf-8');

// ======================== ВАЛИДАЦИЯ ========================
function validateKosmosFile(content) {
    const errors = [];

    if (!/\*\*Статус:\*\*\s+(in progress|done|blocked)/i.test(content)) {
        errors.push('Отсутствует или неверная строка **Статус:**');
    }
    if (!/\*\*Прогресс:\*\*\s+\d+%/.test(content)) {
        errors.push('Отсутствует или неверная строка **Прогресс:**');
    }
    if (!/\*\*Последнее обновление:\*\*\s+\d{4}-\d{2}-\d{2}/.test(content)) {
        errors.push('Отсутствует строка **Последнее обновление:** (формат YYYY-MM-DD)');
    }

    return errors;
}

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
/**
 * Формат шага:
 * ### Шаг <N>: <Title>
 * - [ ] Выполнено
 *  ```<lang> executable
 *       <code>
 * ```
 * Ожидаемый результат: <text>
 * 
 * Результат:
 * (пусто)
 * 
 * Верификация:
 * - [ ] пройдена.
 */

function parseSteps(content) {
    const steps = [];

    // Ищем все шаги, которые ещё не выполнены (- [ ] Выполнено)
    const stepHeaderRegex = /^### Шаг (\d+):\s*(.+)$/gm;
    let headerMatch;

    while ((headerMatch = stepHeaderRegex.exec(content)) !== null) {
        const stepNum = headerMatch[1];
        const stepTitle = headerMatch[2].trim();
        const stepStartPos = headerMatch.index;

        // Находим конец этого шага (начало следующего ### или ## или конец файла)
        const restContent = content.slice(stepStartPos);
        const nextSectionMatch = restContent.match(/\n(?=### Шаг \d+:|## Задача \d+:)/);
        const stepEndPos = nextSectionMatch
            ? stepStartPos + nextSectionMatch.index
            : content.length;

        const stepContent = content.slice(stepStartPos, stepEndPos);

        // Проверяем, выполнен ли шаг
        const isCompleted = /- \[x\] Выполнено/i.test(stepContent);
        if (isCompleted) continue; // Пропускаем выполненные шаги

        // Извлекаем код
        const codeMatch = stepContent.match(/```(\w*)\s+executable\r?\n([\s\S]*?)\r?\n\s*```/);
        const codeLang = codeMatch ? codeMatch[1] : null;
        const code = codeMatch ? codeMatch[2].trim() : null;

        // Извлекаем ожидаемый результат
        const expectedMatch = stepContent.match(/Ожидаемый результат:\s*([\s\S]*?)(?=\r?\n\s*Результат:|$)/);
        const expected = expectedMatch ? expectedMatch[1].trim() : '';

        steps.push({
            num: stepNum,
            title: stepTitle,
            startPos: stepStartPos,
            endPos: stepEndPos,
            stepContent: stepContent,
            codeLang: codeLang,
            code: code,
            expected: expected
        });
    }

    return steps;
}

const steps = parseSteps(content);

console.log(`Найдено невыполненных шагов: ${steps.length}`);

if (steps.length === 0) {
    console.log('\nВсе шаги выполнены! ✓');
    process.exit(0);
}

// ======================== ИНТЕРАКТИВНОЕ ВЫПОЛНЕНИЕ ========================
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let currentStepIdx = 0;

async function processStep() {
    if (currentStepIdx >= steps.length) {
        updateFileAndProgress();
        console.log('\n✅ Все шаги выполнены!');
        rl.close();
        return;
    }

    const step = steps[currentStepIdx];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Шаг ${step.num}: ${step.title}`);
    console.log('='.repeat(60));

    if (step.code) {
        console.log(`\n📋 Код (${step.codeLang || 'unknown'}):`);
        console.log('---');
        console.log(step.code);
        console.log('---');
    } else {
        console.log('\n(Ручной шаг, без кода)');
    }

    console.log(`\n🎯 Ожидаемый результат: ${step.expected}`);

    rl.question('\n▶ Выполнить? [Y/n/q]: ', async (answer) => {
        const ans = answer.toLowerCase().trim();

        if (ans === 'q') {
            console.log('\nВыход без сохранения.');
            rl.close();
            return;
        }

        if (ans === 'n') {
            console.log('⏭ Шаг пропущен.');
            currentStepIdx++;
            processStep();
            return;
        }

        // Выполняем код
        let output = '';
        let execError = null;

        if (step.code && (step.codeLang === 'js' || step.codeLang === 'javascript')) {
            try {
                const script = new vm.Script(step.code);
                const logs = [];
                const sandbox = {
                    console: {
                        log: (...args) => { logs.push(args.join(' ')); },
                        error: (...args) => { logs.push('ERROR: ' + args.join(' ')); }
                    },
                    require,
                    process,
                    setTimeout,
                    setInterval,
                    clearTimeout,
                    clearInterval
                };
                const context = vm.createContext(sandbox);
                script.runInContext(context, { timeout: 5000 });
                output = logs.join('\n');
            } catch (err) {
                execError = err;
                output = `ИСКЛЮЧЕНИЕ: ${err.message}`;
            }
        } else if (step.code) {
            output = `(Код на ${step.codeLang || 'unknown'} — требует ручного выполнения)`;
        } else {
            output = '(Ручной шаг — отметьте результат)';
        }

        console.log('\n📤 Результат выполнения:');
        console.log(output || '(нет вывода)');
        if (execError) {
            console.error('⚠️', execError.message);
        }

        // Обновляем контент шага
        let newStepContent = step.stepContent;

        // Отмечаем как выполненный
        newStepContent = newStepContent.replace(/- \[ \] Выполнено/i, '- [x] Выполнено');

        // Заполняем результат
        const resultSection = `Результат:\n${output || '(нет вывода)'}\n`;
        newStepContent = newStepContent.replace(
            /Результат:\s*\r?\n\(пусто\)/i,
            resultSection
        );

        // Заменяем в общем контенте
        content = content.slice(0, step.startPos) + newStepContent + content.slice(step.endPos);

        // Пересчитываем позиции для следующих шагов
        const diff = newStepContent.length - step.stepContent.length;
        for (let i = currentStepIdx + 1; i < steps.length; i++) {
            steps[i].startPos += diff;
            steps[i].endPos += diff;
        }

        currentStepIdx++;
        processStep();
    });
}

// ======================== ОБНОВЛЕНИЕ ФАЙЛА ========================
function updateFileAndProgress() {
    // Считаем прогресс
    const doneSteps = (content.match(/- \[x\] Выполнено/gi) || []).length;
    const totalSteps = (content.match(/- \[.\] Выполнено/gi) || []).length;
    const progress = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

    // Обновляем прогресс
    content = content.replace(/(\*\*Прогресс:\*\*\s*)\d+%/, `$1${progress}%`);

    // Обновляем дату
    const today = new Date().toISOString().split('T')[0];
    content = content.replace(/(\*\*Последнее обновление:\*\*\s*)\d{4}-\d{2}-\d{2}/, `$1${today}`);

    // Бэкап и сохранение
    const backupPath = `${filePath}.backup.${Date.now()}`;
    fs.copyFileSync(filePath, backupPath);
    console.log(`\n💾 Бэкап: ${backupPath}`);

    fs.writeFileSync(filePath, content);
    console.log(`📊 Прогресс: ${progress}% (${doneSteps}/${totalSteps} шагов)`);
}

// Старт
processStep();
