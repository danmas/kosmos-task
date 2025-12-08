/**
 * file-utils.js
 * Утилиты для работы с .kosmos.md файлами
 */

const fs = require('fs');
const path = require('path');

/**
 * Получить путь к директории данных из MYDATA
 */
function getDataDir() {
    const dataDir = process.env.MYDATA || './data';
    return path.resolve(dataDir);
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
