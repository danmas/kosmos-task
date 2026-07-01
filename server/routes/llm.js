/**
 * llm.js
 * Роуты для LLM интеграции
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// === ЗАГРУЗКА ПРОМПТОВ ===
const PROMPTS_DIR = path.join(__dirname, '..', '..', 'prompts');
const PROMPT_FILES = {
    questions: 'task-factory-questions.md',
    generator: 'task-factory-generator.md'
};

let QUESTIONS_PROMPT = fs.readFileSync(path.join(PROMPTS_DIR, PROMPT_FILES.questions), 'utf-8');
let GENERATOR_PROMPT = fs.readFileSync(path.join(PROMPTS_DIR, PROMPT_FILES.generator), 'utf-8');

/** Перечитать промпты с диска */
function reloadPrompts() {
    QUESTIONS_PROMPT = fs.readFileSync(path.join(PROMPTS_DIR, PROMPT_FILES.questions), 'utf-8');
    GENERATOR_PROMPT = fs.readFileSync(path.join(PROMPTS_DIR, PROMPT_FILES.generator), 'utf-8');
}

// === LLM HELPER ===
async function callLLM(messages, model) {
    const baseUrl = process.env.LLM_SERVER_URL;
    if (!baseUrl) throw new Error('LLM_SERVER_URL не настроен в .env');

    const timeoutMs = parseInt(process.env.LLM_REQUEST_TIMEOUT || '120000', 10);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (process.env.LLM_API_KEY) {
            headers['Authorization'] = `Bearer ${process.env.LLM_API_KEY}`;
        }

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: model || process.env.LLM_MODEL || 'RICH',
                messages,
                temperature: 0.3,
                max_tokens: 4000
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`LLM сервер вернул HTTP ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        if (!content.trim()) {
            throw new Error('Пустой ответ от LLM');
        }

        return content.trim();
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error(`Таймаут запроса к LLM (${Math.round(timeoutMs / 1000)}с)`);
        }
        throw err;
    }
}

// === ПАРСИНГ ВОПРОСОВ ===
function parseQuestions(response) {
    const lines = response.split('\n');
    const questions = [];
    for (const line of lines) {
        const match = line.match(/^\d+\.\s*(.+)$/);
        if (match) {
            questions.push(match[1].trim());
        }
    }
    return questions;
}

// === ИЗВЛЕЧЕНИЕ НАЗВАНИЯ ИЗ .kosmos.md ===
function extractFilename(content) {
    const titleMatch = content.match(/^#\s*(.+?)\s*\.kosmos\.md/m);
    const slug = titleMatch
        ? titleMatch[1].toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
        : `task-${Date.now()}`;
    return `${slug}.kosmos.md`;
}

// === AI HEALTH CHECK ===

/**
 * POST /api/ai-test
 * Проверка доступности LLM сервера
 * Body: { prompt?: string, model?: string }
 */
router.post('/ai-test', async (req, res) => {
    const baseUrl = process.env.LLM_SERVER_URL;
    const model = req.body.model || process.env.LLM_MODEL || 'CHEAP';
    const prompt = req.body.prompt || 'Ответь одним словом: OK';
    const timeoutMs = parseInt(process.env.LLM_REQUEST_TIMEOUT || '15000', 10);

    if (!baseUrl) {
        return res.json({
            success: false,
            error: 'LLM_SERVER_URL не настроен в .env',
            baseUrl: null,
            model,
            latencyMs: 0
        });
    }

    const aiUrl = `${baseUrl}/chat/completions`;
    const start = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (process.env.LLM_API_KEY) {
            headers['Authorization'] = `Bearer ${process.env.LLM_API_KEY}`;
        }

        const aiResponse = await fetch(aiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: 'Ты тестовый echo-бот. Отвечай максимально кратко.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0,
                max_tokens: 32
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const latencyMs = Date.now() - start;

        if (!aiResponse.ok) {
            return res.status(502).json({
                success: false,
                error: `AI сервер вернул ошибку: ${aiResponse.status}`,
                status: aiResponse.status,
                baseUrl,
                model,
                latencyMs
            });
        }

        const data = await aiResponse.json();
        const content = data.choices?.[0]?.message?.content || '';

        if (!content.trim()) {
            return res.json({
                success: false,
                error: 'Пустой ответ от AI',
                baseUrl,
                model,
                latencyMs
            });
        }

        return res.json({
            success: true,
            response: content.trim(),
            baseUrl,
            model,
            latencyMs
        });

    } catch (err) {
        clearTimeout(timeoutId);
        const latencyMs = Date.now() - start;

        if (err.name === 'AbortError') {
            return res.status(500).json({
                success: false,
                error: `Таймаут запроса к AI (${Math.round(timeoutMs / 1000)}с)`,
                baseUrl,
                model,
                latencyMs
            });
        }

        return res.status(500).json({
            success: false,
            error: `Ошибка подключения к AI: ${err.message}`,
            baseUrl,
            model,
            latencyMs
        });
    }
});

// === TASK FACTORY: ДВУХПРОХОДНАЯ ГЕНЕРАЦИЯ ===

/**
 * POST /api/generate/questions
 * Первый проход: LLM генерирует уточняющие вопросы по цели
 * Body: { goal: string, model?: string }
 */
router.post('/generate/questions', async (req, res) => {
    const { goal, model } = req.body;

    if (!goal) {
        return res.status(400).json({
            success: false,
            error: 'Требуется параметр goal'
        });
    }

    try {
        const response = await callLLM([
            { role: 'system', content: QUESTIONS_PROMPT },
            { role: 'user', content: goal }
        ], model);

        const questions = parseQuestions(response);

        if (questions.length === 0) {
            return res.status(500).json({
                success: false,
                error: 'LLM не сгенерировал вопросы',
                raw: response
            });
        }

        return res.json({
            success: true,
            questions
        });

    } catch (err) {
        return res.status(502).json({
            success: false,
            error: `Ошибка LLM: ${err.message}`
        });
    }
});

/**
 * POST /api/generate
 * Второй проход: LLM генерирует .kosmos.md по цели + ответам + подсказкам
 * Body: { goal: string, answers?: [{question, answer}], hints?: {taskCount, stepsPerTask}, model?: string }
 */
router.post('/generate', async (req, res) => {
    const { goal, answers, hints, model } = req.body;

    if (!goal) {
        return res.status(400).json({
            success: false,
            error: 'Требуется параметр goal'
        });
    }

    try {
        // Формируем контекст из ответов пользователя
        let userContent = `Цель: ${goal}`;

        if (answers && Array.isArray(answers) && answers.length > 0) {
            const validAnswers = answers.filter(a => a.answer && a.answer.trim());
            if (validAnswers.length > 0) {
                userContent += '\n\nУточнения от пользователя:\n';
                validAnswers.forEach((a, i) => {
                    userContent += `${i + 1}. ${a.question}: ${a.answer}\n`;
                });
            }
        }

        // Подсказки из UI-селектов
        if (hints) {
            const hintParts = [];
            if (hints.taskCount) hintParts.push(`задач: ${hints.taskCount}`);
            if (hints.stepsPerTask) hintParts.push(`шагов на задачу: ${hints.stepsPerTask}`);
            if (hintParts.length > 0) {
                userContent += `\n\nПредпочтения по структуре (${hintParts.join(', ')}). Определяй количество задач и шагов по смыслу задачи, используй эти числа как ориентир.`;
            }
        }

        const today = new Date().toISOString().split('T')[0];
        userContent += `\n\nТекущая дата: ${today}\n\nСгенерируй .kosmos.md файл.`;

        const content = await callLLM([
            { role: 'system', content: GENERATOR_PROMPT },
            { role: 'user', content: userContent }
        ], model);

        // Извлекаем имя файла из заголовка
        const filename = extractFilename(content);

        // Сохраняем в data/ через fileUtils
        const fileUtils = require('../utils/file-utils');
        let saveFilename = filename;

        // Если файл уже существует — добавляем суффикс
        if (fileUtils.fileExists(saveFilename)) {
            const base = saveFilename.replace(/\.kosmos\.md$/, '');
            saveFilename = `${base}-${Date.now()}.kosmos.md`;
        }

        fileUtils.writeFile(saveFilename, content);

        return res.json({
            success: true,
            filename: saveFilename,
            content
        });

    } catch (err) {
        return res.status(502).json({
            success: false,
            error: `Ошибка генерации: ${err.message}`
        });
    }
});

/**
 * GET /api/llm/health
 * Быстрая проверка конфигурации (без запроса к LLM)
 */
router.get('/llm/health', (req, res) => {
    const serverUrl = process.env.LLM_SERVER_URL;
    const model = process.env.LLM_MODEL;

    res.json({
        success: true,
        configured: !!serverUrl,
        baseUrl: serverUrl || null,
        model: model || null,
        hasApiKey: !!process.env.LLM_API_KEY,
        timeout: parseInt(process.env.LLM_REQUEST_TIMEOUT || '15000', 10)
    });
});

/**
 * GET /api/llm/models
 * Список доступных моделей
 */
router.get('/llm/models', (req, res) => {
    // TODO: Получить список моделей с LLM сервера
    res.json({
        success: true,
        models: [
            { id: 'RICH', description: 'Высокое качество, медленнее' },
            { id: 'FAST', description: 'Быстрый ответ, ниже качество' },
            { id: 'CHEAP', description: 'Экономичный вариант' }
        ],
        current: process.env.LLM_MODEL || 'RICH',
        note: 'Это заглушка. Реальный список будет получен с LLM сервера.'
    });
});

/**
 * GET /api/llm/prompts/:name
 * Отдать содержимое промпта по имени
 * :name = 'questions' | 'generator'
 */
router.get('/llm/prompts/:name', (req, res) => {
    const name = req.params.name;

    // Читаем свежее содержимое с диска
    const filename = PROMPT_FILES[name];
    if (!filename) {
        return res.status(404).json({
            success: false,
            error: `Промпт "${name}" не найден. Доступные: ${Object.keys(PROMPT_FILES).join(', ')}`
        });
    }

    const content = fs.readFileSync(path.join(PROMPTS_DIR, filename), 'utf-8');

    res.json({
        success: true,
        name,
        filename,
        content
    });
});

/**
 * PUT /api/llm/prompts/:name
 * Сохранить отредактированный промпт
 * Body: { content: string }
 */
router.put('/llm/prompts/:name', (req, res) => {
    const name = req.params.name;
    const { content } = req.body;

    if (!content && content !== '') {
        return res.status(400).json({
            success: false,
            error: 'Требуется параметр content'
        });
    }

    const filename = PROMPT_FILES[name];
    if (!filename) {
        return res.status(404).json({
            success: false,
            error: `Промпт "${name}" не найден. Доступные: ${Object.keys(PROMPT_FILES).join(', ')}`
        });
    }

    try {
        const filePath = path.join(PROMPTS_DIR, filename);
        fs.writeFileSync(filePath, content, 'utf-8');

        // Обновляем кэш в памяти
        reloadPrompts();

        console.log(`📝 Промпт обновлён: ${filename} (${content.length} символов)`);

        res.json({
            success: true,
            name,
            filename,
            length: content.length
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: `Ошибка записи: ${err.message}`
        });
    }
});

module.exports = router;
