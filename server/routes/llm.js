/**
 * llm.js
 * Роуты для LLM интеграции (заглушки)
 */

const express = require('express');
const router = express.Router();

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
 * Проверка доступности LLM сервера
 */
router.get('/llm/health', async (req, res) => {
    const serverUrl = process.env.LLM_SERVER_URL;

    if (!serverUrl) {
        return res.json({
            success: true,
            available: false,
            error: 'LLM_SERVER_URL не настроен'
        });
    }

    // TODO: Реализовать проверку доступности LLM сервера
    res.json({
        success: true,
        available: false,
        error: 'Проверка доступности пока не реализована',
        config: {
            serverUrl,
            timeout: process.env.LLM_HEALTH_TIMEOUT || 2000
        }
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
