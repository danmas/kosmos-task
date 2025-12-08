/**
 * executor.js
 * Выполнение JS кода в sandbox (VM)
 */

const vm = require('vm');

/**
 * Выполнить JavaScript код в изолированном окружении
 * @param {string} code - код для выполнения
 * @param {number} timeout - таймаут в мс (по умолчанию 5000)
 * @returns {object} - { success, output, error }
 */
function executeCode(code, timeout = 5000) {
    const logs = [];
    let error = null;

    try {
        const script = new vm.Script(code);

        const sandbox = {
            console: {
                log: (...args) => { logs.push(args.join(' ')); },
                error: (...args) => { logs.push('ERROR: ' + args.join(' ')); },
                warn: (...args) => { logs.push('WARN: ' + args.join(' ')); },
                info: (...args) => { logs.push('INFO: ' + args.join(' ')); }
            },
            require,
            process: {
                env: process.env,
                cwd: () => process.cwd()
            },
            setTimeout,
            setInterval,
            clearTimeout,
            clearInterval,
            Buffer,
            JSON,
            Math,
            Date,
            Array,
            Object,
            String,
            Number,
            Boolean,
            RegExp,
            Error,
            Promise
        };

        const context = vm.createContext(sandbox);
        script.runInContext(context, { timeout });

        return {
            success: true,
            output: logs.join('\n'),
            error: null
        };
    } catch (err) {
        return {
            success: false,
            output: logs.join('\n'),
            error: err.message
        };
    }
}

/**
 * Проверить, поддерживается ли язык для выполнения
 */
function isExecutableLanguage(lang) {
    const supported = ['js', 'javascript'];
    return supported.includes(lang?.toLowerCase());
}

module.exports = {
    executeCode,
    isExecutableLanguage
};
