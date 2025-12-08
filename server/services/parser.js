/**
 * parser.js
 * Парсинг .kosmos.md файлов
 */

/**
 * Парсинг метаданных файла (статус, прогресс, дата)
 */
function parseMetadata(content) {
    const statusMatch = content.match(/\*\*Статус:\*\*\s+(in progress|done|blocked)/i);
    const progressMatch = content.match(/\*\*Прогресс:\*\*\s+(\d+)%/);
    const dateMatch = content.match(/\*\*Последнее обновление:\*\*\s+(\d{4}-\d{2}-\d{2})/);
    const titleMatch = content.match(/^# (.+?)(?:\s*\.kosmos\.md)?$/m);

    return {
        title: titleMatch ? titleMatch[1].trim() : null,
        status: statusMatch ? statusMatch[1].toLowerCase() : null,
        progress: progressMatch ? parseInt(progressMatch[1], 10) : null,
        lastUpdate: dateMatch ? dateMatch[1] : null
    };
}

/**
 * Парсинг цели проекта
 */
function parseGoal(content) {
    const goalMatch = content.match(/## Цель\s*\n([\s\S]*?)(?=\n## |\n---|\z)/);
    return goalMatch ? goalMatch[1].trim() : null;
}

/**
 * Парсинг задач
 */
function parseTasks(content) {
    const tasks = [];
    const taskRegex = /^## Задача (\d+):\s*(.+)$/gm;
    let match;

    while ((match = taskRegex.exec(content)) !== null) {
        const taskNum = parseInt(match[1], 10);
        const taskTitle = match[2].trim();
        const taskStartPos = match.index;

        // Находим конец задачи
        const restContent = content.slice(taskStartPos);
        const nextTaskMatch = restContent.match(/\n(?=## Задача \d+:)/);
        const taskEndPos = nextTaskMatch
            ? taskStartPos + nextTaskMatch.index
            : content.length;

        const taskContent = content.slice(taskStartPos, taskEndPos);

        // Считаем шаги в задаче
        const stepsInTask = (taskContent.match(/### Шаг \d+:/g) || []).length;
        const completedSteps = (taskContent.match(/- \[x\] Выполнено/gi) || []).length;

        tasks.push({
            num: taskNum,
            title: taskTitle,
            stepsCount: stepsInTask,
            completedSteps
        });
    }

    return tasks;
}

/**
 * Парсинг шагов
 */
function parseSteps(content) {
    const steps = [];
    const stepHeaderRegex = /^### Шаг (\d+):\s*(.+)$/gm;
    let headerMatch;

    while ((headerMatch = stepHeaderRegex.exec(content)) !== null) {
        const stepNum = parseInt(headerMatch[1], 10);
        const stepTitle = headerMatch[2].trim();
        const stepStartPos = headerMatch.index;

        // Находим конец шага
        const restContent = content.slice(stepStartPos);
        const nextSectionMatch = restContent.match(/\n(?=### Шаг \d+:|## Задача \d+:)/);
        const stepEndPos = nextSectionMatch
            ? stepStartPos + nextSectionMatch.index
            : content.length;

        const stepContent = content.slice(stepStartPos, stepEndPos);

        // Проверяем статус выполнения
        const isCompleted = /- \[x\] Выполнено/i.test(stepContent);

        // Извлекаем код
        const codeMatch = stepContent.match(/```(\w*)\s+executable\r?\n([\s\S]*?)\r?\n\s*```/);
        const codeLang = codeMatch ? codeMatch[1] : null;
        const code = codeMatch ? codeMatch[2].trim() : null;

        // Извлекаем ожидаемый результат
        const expectedMatch = stepContent.match(/Ожидаемый результат:\s*([\s\S]*?)(?=\r?\n\s*Результат:|$)/);
        const expected = expectedMatch ? expectedMatch[1].trim() : '';

        // Извлекаем результат
        const resultMatch = stepContent.match(/Результат:\s*\r?\n([\s\S]*?)(?=\r?\n\s*Верификация:|$)/);
        const result = resultMatch ? resultMatch[1].trim() : null;

        // Извлекаем статус верификации
        const verificationPassed = /- \[x\] пройдена\./i.test(stepContent);

        // Определяем номер задачи
        const beforeStep = content.slice(0, stepStartPos);
        const taskMatches = [...beforeStep.matchAll(/## Задача (\d+):/g)];
        const taskNum = taskMatches.length > 0
            ? parseInt(taskMatches[taskMatches.length - 1][1], 10)
            : null;

        steps.push({
            num: stepNum,
            taskNum,
            title: stepTitle,
            completed: isCompleted,
            codeLang,
            code,
            expected,
            result: result === '(пусто)' ? null : result,
            verificationPassed
        });
    }

    return steps;
}

/**
 * Парсинг прогресса
 */
function parseProgress(content) {
    const totalSteps = (content.match(/- \[.\] Выполнено/gi) || []).length;
    const completedSteps = (content.match(/- \[x\] Выполнено/gi) || []).length;
    const pendingSteps = totalSteps - completedSteps;
    const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    return {
        totalSteps,
        completedSteps,
        pendingSteps,
        progress
    };
}

/**
 * Полный парсинг файла
 */
function parseKosmosFile(content) {
    return {
        metadata: parseMetadata(content),
        goal: parseGoal(content),
        tasks: parseTasks(content),
        steps: parseSteps(content),
        progress: parseProgress(content)
    };
}

module.exports = {
    parseMetadata,
    parseGoal,
    parseTasks,
    parseSteps,
    parseProgress,
    parseKosmosFile
};
