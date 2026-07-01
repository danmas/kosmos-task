/**
 * llm.js
 * Роуты для LLM интеграции
 */

const express = require('express');
const router = express.Router();

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

/**
 * POST /api/generate
 * Сгенерировать .kosmos.md файл по описанию
 * Body: { prompt: string, model?: string }
 */
router.post('/generate', (req, res) => {
    const { prompt, model } = req.body;

    if (!prompt) {
        return res.status(400).json({
            success: false,
            error: 'Требуется параметр prompt'
        });
    }

    // TODO: Реализовать интеграцию с LLM сервером
    res.status(501).json({
        success: false,
        error: 'LLM интеграция пока не реализована',
        config: {
            serverUrl: process.env.LLM_SERVER_URL || 'not configured',
            model: model || process.env.LLM_MODEL || 'not configured'
        }
    });
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

module.exports = router;
