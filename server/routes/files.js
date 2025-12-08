/**
 * files.js
 * Роуты для CRUD операций с .kosmos.md файлами
 */

const express = require('express');
const router = express.Router();

const fileUtils = require('../utils/file-utils');
const parser = require('../services/parser');
const validator = require('../services/validator');

/**
 * GET /api/files
 * Список всех .kosmos.md файлов
 */
router.get('/', (req, res) => {
    try {
        const files = fileUtils.listKosmosFiles();
        res.json({
            success: true,
            count: files.length,
            files
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/files/:filename
 * Получить содержимое файла
 */
router.get('/:filename', (req, res) => {
    try {
        const { filename } = req.params;

        if (!filename.endsWith('.kosmos.md')) {
            return res.status(400).json({
                success: false,
                error: 'Файл должен иметь расширение .kosmos.md'
            });
        }

        const content = fileUtils.readFile(filename);

        if (content === null) {
            return res.status(404).json({
                success: false,
                error: 'Файл не найден'
            });
        }

        res.json({
            success: true,
            filename,
            content
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/files/:filename/parse
 * Парсинг файла (полная информация)
 */
router.get('/:filename/parse', (req, res) => {
    try {
        const { filename } = req.params;
        const content = fileUtils.readFile(filename);

        if (content === null) {
            return res.status(404).json({
                success: false,
                error: 'Файл не найден'
            });
        }

        const parsed = parser.parseKosmosFile(content);

        res.json({
            success: true,
            filename,
            ...parsed
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/files/:filename/progress
 * Получить прогресс выполнения
 */
router.get('/:filename/progress', (req, res) => {
    try {
        const { filename } = req.params;
        const content = fileUtils.readFile(filename);

        if (content === null) {
            return res.status(404).json({
                success: false,
                error: 'Файл не найден'
            });
        }

        const progress = parser.parseProgress(content);
        const metadata = parser.parseMetadata(content);

        res.json({
            success: true,
            filename,
            title: metadata.title,
            status: metadata.status,
            ...progress
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/files
 * Создать новый файл
 * Body: { filename: string, content: string }
 */
router.post('/', (req, res) => {
    try {
        const { filename, content } = req.body;

        if (!filename || !content) {
            return res.status(400).json({
                success: false,
                error: 'Требуются параметры filename и content'
            });
        }

        if (!filename.endsWith('.kosmos.md')) {
            return res.status(400).json({
                success: false,
                error: 'Файл должен иметь расширение .kosmos.md'
            });
        }

        if (fileUtils.fileExists(filename)) {
            return res.status(409).json({
                success: false,
                error: 'Файл уже существует'
            });
        }

        fileUtils.writeFile(filename, content);

        res.status(201).json({
            success: true,
            message: 'Файл создан',
            filename
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/files/:filename
 * Обновить файл
 * Body: { content: string }
 */
router.put('/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({
                success: false,
                error: 'Требуется параметр content'
            });
        }

        if (!fileUtils.fileExists(filename)) {
            return res.status(404).json({
                success: false,
                error: 'Файл не найден'
            });
        }

        // Создаём бэкап перед обновлением
        const backupPath = fileUtils.createBackup(filename);
        fileUtils.writeFile(filename, content);

        res.json({
            success: true,
            message: 'Файл обновлён',
            filename,
            backupPath
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/files/:filename
 * Удалить файл
 */
router.delete('/:filename', (req, res) => {
    try {
        const { filename } = req.params;

        if (!fileUtils.fileExists(filename)) {
            return res.status(404).json({
                success: false,
                error: 'Файл не найден'
            });
        }

        // Создаём бэкап перед удалением
        const backupPath = fileUtils.createBackup(filename);
        fileUtils.deleteFile(filename);

        res.json({
            success: true,
            message: 'Файл удалён',
            filename,
            backupPath
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/validate
 * Валидация файла
 * Body: { content: string } или { filename: string }
 */
router.post('/validate', (req, res) => {
    try {
        let content = req.body.content;
        const { filename } = req.body;

        if (!content && filename) {
            content = fileUtils.readFile(filename);
            if (content === null) {
                return res.status(404).json({
                    success: false,
                    error: 'Файл не найден'
                });
            }
        }

        if (!content) {
            return res.status(400).json({
                success: false,
                error: 'Требуется параметр content или filename'
            });
        }

        const result = validator.validateKosmosFile(content);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
