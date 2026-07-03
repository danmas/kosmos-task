/**
 * kosmos-task REST API Server
 * 
 * Запуск: npm run server
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config.json');

/**
 * Прочитать и вернуть содержимое config.json
 */
function readConfig() {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

/**
 * Записать config.json
 */
function writeConfig(config) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

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

// UI статика
app.use('/ui', express.static(path.join(__dirname, '..', 'ui')));

// Роуты
app.use('/api/files', filesRouter);
app.use('/api/files', executeRouter);
app.use('/api', llmRouter);

// Health check
app.get('/api/health', (req, res) => {
    let dataDir = './data';
    try {
        const config = readConfig();
        dataDir = config.DATA_DIR || dataDir;
    } catch {}
    res.json({
        success: true,
        status: 'ok',
        version: '2.0.0',
        dataDir: path.resolve(PROJECT_ROOT, dataDir)
    });
});

// === DATA_DIR config endpoints ===

/**
 * GET /api/config/data-dir
 * Вернуть текущий путь к папке данных
 */
app.get('/api/config/data-dir', (req, res) => {
    try {
        const config = readConfig();
        const dataDir = config.DATA_DIR || './data';
        res.json({
            success: true,
            dataDir: path.resolve(PROJECT_ROOT, dataDir)
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/config/data-dir
 * Сохранить новый путь к папке данных
 * Body: { dataDir: string }
 */
app.put('/api/config/data-dir', (req, res) => {
    try {
        const { dataDir } = req.body;
        if (!dataDir || typeof dataDir !== 'string') {
            return res.status(400).json({ success: false, error: 'Требуется параметр dataDir (строка)' });
        }

        const resolved = path.resolve(dataDir);

        // Создаём папку если не существует
        if (!fs.existsSync(resolved)) {
            fs.mkdirSync(resolved, { recursive: true });
        }

        const config = readConfig();
        // Сохраняем в config.json как относительный путь если он внутри проекта, иначе абсолютный
        const relative = path.relative(PROJECT_ROOT, resolved);
        config.DATA_DIR = relative && !relative.startsWith('..') ? './' + relative.replace(/\\/g, '/') : resolved;
        writeConfig(config);

        res.json({
            success: true,
            message: 'Путь сохранён',
            dataDir: resolved
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// UI redirect
app.get('/', (req, res) => {
    res.redirect('/ui/');
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
                'POST /api/generate/questions': 'Генерация уточняющих вопросов (проход 1)',
                'POST /api/generate': 'Генерация .kosmos.md файла (проход 2)',
                'GET /api/llm/health': 'Проверка LLM конфигурации',
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

// Запуск сервера с WebSocket
const server = http.createServer(app);
const { setupWebSocket } = require('./ws-handler');
setupWebSocket(server);

server.listen(PORT, () => {
    console.log(`\n🚀 kosmos-task API Server запущен`);
    console.log(`   URL: http://localhost:${PORT}`);
    console.log(`   UI:  http://localhost:${PORT}/ui/`);
    console.log(`   Data: ${(() => { try { const c = readConfig(); return path.resolve(PROJECT_ROOT, c.DATA_DIR || './data'); } catch { return path.resolve(PROJECT_ROOT, 'data'); } })()}`);
    console.log(`\n📚 Документация: http://localhost:${PORT}/api`);
    console.log(`❤️  Health check: http://localhost:${PORT}/api/health\n`);
});
