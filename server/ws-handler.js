/**
 * ws-handler.js
 * WebSocket обработчик для runner и фабрики
 */

const { WebSocketServer } = require('ws');
const parser = require('./services/parser');
const executor = require('./services/executor');
const fileUtils = require('./utils/file-utils');

function setupWebSocket(server) {
    const wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws) => {
        console.log('🔌 WS клиент подключён');

        ws.on('message', async (raw) => {
            let msg;
            try {
                msg = JSON.parse(raw);
            } catch {
                ws.send(JSON.stringify({ type: 'error', error: 'Неверный JSON' }));
                return;
            }

            try {
                switch (msg.action) {
                    case 'run':        await handleRun(ws, msg); break;
                    case 'execute_step': await handleExecuteStep(ws, msg); break;
                    case 'run_all':    await handleRunAll(ws, msg); break;
                    default:
                        ws.send(JSON.stringify({ type: 'error', error: `Неизвестное действие: ${msg.action}` }));
                }
            } catch (err) {
                ws.send(JSON.stringify({ type: 'error', error: err.message }));
            }
        });

        ws.on('close', () => console.log('🔌 WS клиент отключён'));
    });

    console.log('🔌 WebSocket сервер готов на /ws');
    return wss;
}

/**
 * Выполнить один шаг
 */
async function handleExecuteStep(ws, { filename, stepNum }) {
    const content = fileUtils.readFile(filename);
    if (!content) {
        ws.send(JSON.stringify({ type: 'error', error: 'Файл не найден' }));
        return;
    }

    const steps = parser.parseSteps(content);
    const step = steps.find(s => s.num === stepNum);
    if (!step || !step.code) {
        ws.send(JSON.stringify({ type: 'error', error: `Шаг ${stepNum} не найден или без кода` }));
        return;
    }

    ws.send(JSON.stringify({ type: 'step_start', stepNum, title: step.title }));

    const result = executor.executeCode(step.code);

    ws.send(JSON.stringify({
        type: 'step_done',
        stepNum,
        title: step.title,
        output: result.output,
        success: result.success,
        error: result.error
    }));
}

/**
 * Выполнить все невыполненные шаги файла последовательно
 */
async function handleRunAll(ws, { filename }) {
    const content = fileUtils.readFile(filename);
    if (!content) {
        ws.send(JSON.stringify({ type: 'error', error: 'Файл не найден' }));
        return;
    }

    const steps = parser.parseSteps(content);
    const pending = steps.filter(s => !s.completed && s.code);

    ws.send(JSON.stringify({
        type: 'run_start',
        filename,
        totalSteps: steps.length,
        pendingSteps: pending.length
    }));

    let fileContent = content;

    for (let i = 0; i < pending.length; i++) {
        const step = pending[i];

        ws.send(JSON.stringify({
            type: 'step_start',
            stepNum: step.num,
            title: step.title,
            current: i + 1,
            total: pending.length
        }));

        const result = executor.executeCode(step.code);

        // Обновляем файл
        fileContent = updateStepInFile(fileContent, step.num, result);
        fileUtils.writeFile(filename, fileContent);

        const progress = parser.parseProgress(fileContent);

        ws.send(JSON.stringify({
            type: 'step_done',
            stepNum: step.num,
            title: step.title,
            output: result.output,
            success: result.success,
            error: result.error,
            current: i + 1,
            total: pending.length,
            progress: progress.progress
        }));

        // Небольшая задержка для визуализации
        await new Promise(r => setTimeout(r, 300));
    }

    // Финальное обновление статуса
    if (pending.length > 0) {
        const finalProgress = parser.parseProgress(fileContent);
        if (finalProgress.progress === 100) {
            fileContent = fileContent.replace(
                /(\*\*Статус:\*\*\s*)in progress/i,
                '$1done'
            );
            fileUtils.writeFile(filename, fileContent);
        }
        const today = new Date().toISOString().split('T')[0];
        fileContent = fileContent.replace(
            /(\*\*Последнее обновление:\*\*\s*)\d{4}-\d{2}-\d{2}/,
            `$1${today}`
        );
        fileUtils.writeFile(filename, fileContent);
    }

    ws.send(JSON.stringify({
        type: 'run_done',
        filename,
        progress: parser.parseProgress(fileContent).progress
    }));
}

/**
 * Заглушка — то же что run_all
 */
async function handleRun(ws, msg) {
    return handleRunAll(ws, msg);
}

/**
 * Обновить шаг в содержимом файла после выполнения
 */
function updateStepInFile(content, stepNum, result) {
    // Отмечаем как выполненный
    const stepHeaderRegex = new RegExp(
        `(### Шаг ${stepNum}:[\\s\\S]*?)- \\[ \\] Выполнено`, 'i'
    );
    content = content.replace(stepHeaderRegex, '$1- [x] Выполнено');

    // Записываем результат
    const resultText = result.success ? result.output : `ОШИБКА: ${result.error}`;
    const resultRegex = new RegExp(
        `(### Шаг ${stepNum}:[\\s\\S]*?Результат:\\s*\\r?\\n)\\(пусто\\)`, 'i'
    );
    content = content.replace(resultRegex, `$1${resultText}`);

    // Верификация
    const verifyRegex = new RegExp(
        `(### Шаг ${stepNum}:[\\s\\S]*?Верификация:\\s*\\r?\\n)- \\[ \\] пройдена\\.`, 'i'
    );
    if (result.success) {
        content = content.replace(verifyRegex, '$1- [x] пройдена.');
    }

    // Обновляем прогресс
    const progress = parser.parseProgress(content);
    content = content.replace(
        /(\*\*Прогресс:\*\*\s*)\d+%/,
        `$1${progress.progress}%`
    );

    return content;
}

module.exports = { setupWebSocket };
