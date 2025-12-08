/**
 * execute.js
 * Роуты для выполнения шагов
 */

const express = require('express');
const router = express.Router();

const fileUtils = require('../utils/file-utils');
const parser = require('../services/parser');
const executor = require('../services/executor');

/**
 * POST /api/files/:filename/steps/:stepNum/execute
 * Выполнить код шага
 */
router.post('/:filename/steps/:stepNum/execute', (req, res) => {
    try {
        const { filename, stepNum } = req.params;
        const stepNumber = parseInt(stepNum, 10);

        const content = fileUtils.readFile(filename);
        if (content === null) {
            return res.status(404).json({
                success: false,
                error: 'Файл не найден'
            });
        }

        const steps = parser.parseSteps(content);
        const step = steps.find(s => s.num === stepNumber);

        if (!step) {
            return res.status(404).json({
                success: false,
                error: `Шаг ${stepNumber} не найден`
            });
        }

        if (!step.code) {
            return res.status(400).json({
                success: false,
                error: 'Шаг не содержит исполняемого кода'
            });
        }

        if (!executor.isExecutableLanguage(step.codeLang)) {
            return res.status(400).json({
                success: false,
                error: `Язык ${step.codeLang} не поддерживается для выполнения`
            });
        }

        const result = executor.executeCode(step.code);

        res.json({
            success: true,
            step: {
                num: step.num,
                title: step.title,
                codeLang: step.codeLang
            },
            execution: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PATCH /api/files/:filename/steps/:stepNum/complete
 * Отметить шаг как выполненный
 */
router.patch('/:filename/steps/:stepNum/complete', (req, res) => {
    try {
        const { filename, stepNum } = req.params;
        const { result } = req.body; // опциональный результат
        const stepNumber = parseInt(stepNum, 10);

        let content = fileUtils.readFile(filename);
        if (content === null) {
            return res.status(404).json({
                success: false,
                error: 'Файл не найден'
            });
        }

        const steps = parser.parseSteps(content);
        const step = steps.find(s => s.num === stepNumber);

        if (!step) {
            return res.status(404).json({
                success: false,
                error: `Шаг ${stepNumber} не найден`
            });
        }

        if (step.completed) {
            return res.status(400).json({
                success: false,
                error: 'Шаг уже выполнен'
            });
        }

        // Создаём бэкап
        fileUtils.createBackup(filename);

        // Находим и обновляем шаг в контенте
        const stepHeaderRegex = new RegExp(`(### Шаг ${stepNumber}:[\\s\\S]*?)- \\[ \\] Выполнено`, 'i');
        content = content.replace(stepHeaderRegex, '$1- [x] Выполнено');

        // Обновляем результат если передан
        if (result) {
            const resultRegex = new RegExp(`(### Шаг ${stepNumber}:[\\s\\S]*?Результат:\\s*\\r?\\n)\\(пусто\\)`, 'i');
            content = content.replace(resultRegex, `$1${result}`);
        }

        // Обновляем прогресс
        const progressInfo = parser.parseProgress(content);
        content = content.replace(/(\*\*Прогресс:\*\*\s*)\d+%/, `$1${progressInfo.progress}%`);

        // Обновляем дату
        const today = new Date().toISOString().split('T')[0];
        content = content.replace(/(\*\*Последнее обновление:\*\*\s*)\d{4}-\d{2}-\d{2}/, `$1${today}`);

        fileUtils.writeFile(filename, content);

        res.json({
            success: true,
            message: `Шаг ${stepNumber} отмечен как выполненный`,
            progress: progressInfo
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PATCH /api/files/:filename/steps/:stepNum/skip
 * Пропустить шаг (отметить как выполненный с примечанием)
 */
router.patch('/:filename/steps/:stepNum/skip', (req, res) => {
    try {
        const { filename, stepNum } = req.params;
        const { reason } = req.body; // опциональная причина пропуска
        const stepNumber = parseInt(stepNum, 10);

        let content = fileUtils.readFile(filename);
        if (content === null) {
            return res.status(404).json({
                success: false,
                error: 'Файл не найден'
            });
        }

        const steps = parser.parseSteps(content);
        const step = steps.find(s => s.num === stepNumber);

        if (!step) {
            return res.status(404).json({
                success: false,
                error: `Шаг ${stepNumber} не найден`
            });
        }

        // Создаём бэкап
        fileUtils.createBackup(filename);

        // Отмечаем как выполненный
        const stepHeaderRegex = new RegExp(`(### Шаг ${stepNumber}:[\\s\\S]*?)- \\[ \\] Выполнено`, 'i');
        content = content.replace(stepHeaderRegex, '$1- [x] Выполнено');

        // Записываем причину пропуска как результат
        const skipResult = reason ? `(Пропущено: ${reason})` : '(Пропущено)';
        const resultRegex = new RegExp(`(### Шаг ${stepNumber}:[\\s\\S]*?Результат:\\s*\\r?\\n)\\(пусто\\)`, 'i');
        content = content.replace(resultRegex, `$1${skipResult}`);

        // Обновляем прогресс
        const progressInfo = parser.parseProgress(content);
        content = content.replace(/(\*\*Прогресс:\*\*\s*)\d+%/, `$1${progressInfo.progress}%`);

        // Обновляем дату
        const today = new Date().toISOString().split('T')[0];
        content = content.replace(/(\*\*Последнее обновление:\*\*\s*)\d{4}-\d{2}-\d{2}/, `$1${today}`);

        fileUtils.writeFile(filename, content);

        res.json({
            success: true,
            message: `Шаг ${stepNumber} пропущен`,
            progress: progressInfo
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
