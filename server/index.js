/**
 * kosmos-task REST API Server
 * 
 * Запуск: npm run server
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

// Роуты
const filesRouter = require('./routes/files');
const executeRouter = require('./routes/execute');
const llmRouter = require('./routes/llm');

const app = express();
const PORT = process.env.PORT || 3014;

// Middleware
app.use(cors());
app.use(express.json());

// Логирование запросов
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// Роуты
app.use('/api/files', filesRouter);
app.use('/api/files', executeRouter);
app.use('/api', llmRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'ok',
        version: '2.0.0',
        dataDir: process.env.MYDATA || './data'
    });
});

// Информация о сервере
app.get('/api', (req, res) => {
    res.json({
        name: 'kosmos-task API',
        version: '2.0.0',
        endpoints: {
            files: {
                'GET /api/files': 'Список файлов',
                'GET /api/files/:filename': 'Содержимое файла',
                'GET /api/files/:filename/parse': 'Парсинг файла',
                'GET /api/files/:filename/progress': 'Прогресс',
                'POST /api/files': 'Создать файл',
                'PUT /api/files/:filename': 'Обновить файл',
                'DELETE /api/files/:filename': 'Удалить файл',
                'POST /api/files/validate': 'Валидация'
            },
            execute: {
                'POST /api/files/:filename/steps/:stepNum/execute': 'Выполнить шаг',
                'PATCH /api/files/:filename/steps/:stepNum/complete': 'Отметить выполненным',
                'PATCH /api/files/:filename/steps/:stepNum/skip': 'Пропустить шаг'
            },
            llm: {
                'POST /api/generate': 'Генерация файла (TODO)',
                'GET /api/llm/health': 'Проверка LLM сервера',
                'GET /api/llm/models': 'Список моделей'
            },
            other: {
                'GET /api/health': 'Проверка здоровья сервера'
            }
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint не найден'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({
        success: false,
        error: err.message
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`\n🚀 kosmos-task API Server запущен`);
    console.log(`   URL: http://localhost:${PORT}`);
    console.log(`   Data: ${path.resolve(process.env.MYDATA || './data')}`);
    console.log(`\n📚 Документация: http://localhost:${PORT}/api`);
    console.log(`❤️  Health check: http://localhost:${PORT}/api/health\n`);
});
