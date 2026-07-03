/**
 * file-utils.js
 * Утилиты для работы с .kosmos.md файлами
 */

const fs = require('fs');
const path = require('path');

// Путь к корню проекта (server/utils/../../)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config.json');

/**
 * Прочитать config.json и вернуть DATA_DIR (резолвится относительно корня проекта)
 */
function getDataDir() {
    try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const config = JSON.parse(raw);
        if (config.DATA_DIR) {
            return path.resolve(PROJECT_ROOT, config.DATA_DIR);
        }
    } catch (e) {
        // Если config.json отсутствует или битый — fallback
        console.warn('[file-utils] config.json недоступен, используется ./data');
    }
    return path.resolve(PROJECT_ROOT, 'data');
}

/**
 * Получить список .kosmos.md файлов
 */
function listKosmosFiles() {
    const dataDir = getDataDir();

    if (!fs.existsSync(dataDir)) {
        return [];
    }

    const files = fs.readdirSync(dataDir);
    return files
        .filter(f => f.endsWith('.kosmos.md'))
        .map(filename => {
            const filePath = path.join(dataDir, filename);
            const stats = fs.statSync(filePath);
            return {
                filename,
                size: stats.size,
                modified: stats.mtime.toISOString()
            };
        });
}

/**
 * Прочитать файл
 */
function readFile(filename) {
    const filePath = path.join(getDataDir(), filename);

    if (!fs.existsSync(filePath)) {
        return null;
    }

    return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Записать файл
 */
function writeFile(filename, content) {
    const dataDir = getDataDir();

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const filePath = path.join(dataDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
}

/**
 * Удалить файл
 */
function deleteFile(filename) {
    const filePath = path.join(getDataDir(), filename);

    if (!fs.existsSync(filePath)) {
        return false;
    }

    fs.unlinkSync(filePath);
    return true;
}

/**
 * Проверить существование файла
 */
function fileExists(filename) {
    const filePath = path.join(getDataDir(), filename);
    return fs.existsSync(filePath);
}

/**
 * Создать бэкап файла
 */
function createBackup(filename) {
    const filePath = path.join(getDataDir(), filename);

    if (!fs.existsSync(filePath)) {
        return null;
    }

    const backupPath = `${filePath}.backup.${Date.now()}`;
    fs.copyFileSync(filePath, backupPath);
    return backupPath;
}

module.exports = {
    getDataDir,
    listKosmosFiles,
    readFile,
    writeFile,
    deleteFile,
    fileExists,
    createBackup
};
