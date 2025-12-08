/**
 * validator.js
 * Валидация структуры .kosmos.md файлов
 */

/**
 * Валидация обязательных полей .kosmos.md файла
 * @param {string} content - содержимое файла
 * @returns {object} - { valid: boolean, errors: string[] }
 */
function validateKosmosFile(content) {
    const errors = [];

    // Проверка статуса
    if (!/\*\*Статус:\*\*\s+(in progress|done|blocked)/i.test(content)) {
        errors.push('Отсутствует или неверная строка **Статус:** (допустимые: in progress, done, blocked)');
    }

    // Проверка прогресса
    if (!/\*\*Прогресс:\*\*\s+\d+%/.test(content)) {
        errors.push('Отсутствует или неверная строка **Прогресс:** (формат: N%)');
    }

    // Проверка даты
    if (!/\*\*Последнее обновление:\*\*\s+\d{4}-\d{2}-\d{2}/.test(content)) {
        errors.push('Отсутствует строка **Последнее обновление:** (формат: YYYY-MM-DD)');
    }

    // Проверка наличия цели
    if (!/## Цель/.test(content)) {
        errors.push('Отсутствует раздел ## Цель');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    validateKosmosFile
};
