/**
 * factory.js — Фабрика задач: два таба (Вопросы + Генерация)
 * Двухпроходная схема: LLM задаёт вопросы → LLM генерирует .kosmos.md
 */

const FactoryPage = {
    // === STATE ===
    activeTab: 'questions',
    goal: '',
    questions: [],       // [{question, answer}]
    generated: null,
    resultFilename: null,
    promptsCache: {},    // {questions: '...', generator: '...'}

    // === INIT ===
    render(container) {
        container.innerHTML = `
            <div class="page-header">
                <h2>🏭 Фабрика задач</h2>
            </div>
            <div class="page-body" id="factoryBody"></div>`;

        this.activeTab = 'questions';
        this.goal = '';
        this.questions = [];
        this.generated = null;
        this.resultFilename = null;
        this.renderPage();
    },

    renderPage() {
        const body = document.getElementById('factoryBody');
        const genDisabled = this.questions.length === 0;

        body.innerHTML = `
            <div style="max-width:700px;">
                <div class="factory-tabs">
                    <div class="factory-tab ${this.activeTab === 'questions' ? 'active' : ''}"
                         onclick="FactoryPage.switchTab('questions')">
                        ❓ Вопросы
                    </div>
                    <div class="factory-tab ${this.activeTab === 'generation' ? 'active' : ''} ${genDisabled ? 'disabled' : ''}"
                         onclick="FactoryPage.switchTab('generation')">
                        🏭 Генерация
                        ${this.questions.length > 0 ? `<span class="tab-badge">${this.questions.length} вопр.</span>` : ''}
                    </div>
                </div>
                <div id="factoryTabContent"></div>
            </div>`;

        if (this.activeTab === 'questions') {
            this.renderQuestionsTab();
        } else {
            this.renderGenerationTab();
        }
    },

    switchTab(tab) {
        if (tab === 'generation' && this.questions.length === 0) {
            app.toast('Сначала задайте вопросы на вкладке «Вопросы»', 'info');
            return;
        }
        this.activeTab = tab;
        this.renderPage();
    },

    // ================================================================
    // TAB 1: ВОПРОСЫ
    // ================================================================
    renderQuestionsTab() {
        const content = document.getElementById('factoryTabContent');
        content.innerHTML = `
            <p style="color:var(--text2);margin-bottom:20px;font-size:14px;">
                Опишите цель задачи — LLM задаст уточняющие вопросы для формирования детального плана.
            </p>

            <div class="form-group">
                <label>Цель задачи</label>
                <input type="text" class="form-input" id="factoryGoal"
                    placeholder="Например: Создать калькулятор Fibonacci с проверкой чётности"
                    style="font-size:15px;padding:12px;"
                    value="${app.escapeHtml(this.goal)}">
            </div>

            <div style="display:flex;gap:16px;">
                <div class="form-group" style="flex:1;">
                    <label>Подсказка: задач</label>
                    <select class="form-input" id="factoryTaskCount" style="max-width:120px;">
                        <option value="1">1</option>
                        <option value="2" selected>2</option>
                        <option value="3">3</option>
                    </select>
                </div>
                <div class="form-group" style="flex:1;">
                    <label>Подсказка: шагов</label>
                    <select class="form-input" id="factoryStepsPerTask" style="max-width:120px;">
                        <option value="1">1</option>
                        <option value="2" selected>2</option>
                        <option value="3">3</option>
                    </select>
                </div>
            </div>

            <div class="btn-group" style="margin-top:8px;">
                <button class="btn btn-purple" id="btnAsk" onclick="FactoryPage.askQuestions()">
                    ❓ Задать вопросы
                </button>
                <button class="btn btn-secondary" onclick="FactoryPage.showPrompt('questions')">
                    📄 Посмотреть промпт
                </button>
            </div>

            ${this.questions.length > 0 ? `
                <div class="validation-ok" style="margin-top:16px;cursor:pointer;"
                     onclick="FactoryPage.switchTab('generation')">
                    ✅ Вопросы получены (${this.questions.length} шт.) — перейдите на вкладку «Генерация»
                </div>
            ` : ''}

            <div id="factoryStatus" style="margin-top:12px;"></div>
        `;

        // Enter = задать вопросы
        setTimeout(() => {
            const input = document.getElementById('factoryGoal');
            if (input) input.addEventListener('keydown', e => {
                if (e.key === 'Enter') FactoryPage.askQuestions();
            });
        }, 50);
    },

    async askQuestions() {
        const goal = document.getElementById('factoryGoal').value.trim();
        if (!goal) {
            app.toast('Укажите цель задачи', 'error');
            return;
        }
        this.goal = goal;

        document.getElementById('btnAsk').disabled = true;
        document.getElementById('factoryStatus').innerHTML =
            '<div style="color:var(--yellow);">⏳ LLM генерирует уточняющие вопросы...</div>';

        try {
            const res = await app.api('/generate/questions', {
                method: 'POST',
                body: { goal }
            });

            if (res.success && res.questions && res.questions.length > 0) {
                this.questions = res.questions.map(q => ({ question: q, answer: '' }));
                this.renderPage();
                app.toast(`Получено ${this.questions.length} вопросов`, 'success');
                // Автоматически переключаемся на Генерацию
                this.switchTab('generation');
            } else {
                document.getElementById('factoryStatus').innerHTML =
                    `<div style="color:var(--red);">⚠️ ${res.error || 'LLM не сгенерировал вопросы'}</div>`;
                document.getElementById('btnAsk').disabled = false;
            }
        } catch (err) {
            document.getElementById('factoryStatus').innerHTML =
                `<div style="color:var(--red);">⚠️ Ошибка: ${err.message}. Будет использован шаблон.</div>`;
            document.getElementById('btnAsk').disabled = false;
        }
    },

    // ================================================================
    // TAB 2: ГЕНЕРАЦИЯ
    // ================================================================
    renderGenerationTab() {
        const content = document.getElementById('factoryTabContent');

        const questionsHtml = this.questions.map((q, i) => `
            <div class="factory-q">
                <label>${i + 1}. ${app.escapeHtml(q.question)}</label>
                <input type="text" class="form-input factory-answer" data-index="${i}"
                    value="${app.escapeHtml(q.answer)}"
                    placeholder="Ответ (необязательно)">
            </div>
        `).join('');

        content.innerHTML = `
            <div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:16px;">
                <strong>🎯 Цель:</strong> ${app.escapeHtml(this.goal)}
            </div>

            <p style="color:var(--text2);margin-bottom:12px;font-size:13px;">
                Ответьте на уточняющие вопросы. Пустые ответы будут пропущены.
            </p>

            <div class="factory-questions">
                ${questionsHtml}
            </div>

            <div class="btn-group" style="margin-top:16px;">
                <button class="btn btn-purple" id="btnGenerate" onclick="FactoryPage.generate()">
                    🏭 Сгенерить
                </button>
                <button class="btn btn-secondary" onclick="FactoryPage.showPrompt('generator')">
                    📄 Посмотреть промпт
                </button>
                <button class="btn btn-secondary" onclick="FactoryPage.switchTab('questions')">
                    ← Назад к вопросам
                </button>
            </div>

            <div id="factoryStatus" style="margin-top:12px;"></div>
            <div id="factoryResult"></div>
        `;

        // Сохраняем ответы при вводе
        setTimeout(() => {
            document.querySelectorAll('.factory-answer').forEach(input => {
                input.addEventListener('input', e => {
                    const idx = parseInt(e.target.dataset.index);
                    this.questions[idx].answer = e.target.value.trim();
                });
            });
        }, 50);
    },

    async generate() {
        // Собираем ответы из DOM
        document.querySelectorAll('.factory-answer').forEach(input => {
            const idx = parseInt(input.dataset.index);
            this.questions[idx].answer = input.value.trim();
        });

        const answers = this.questions
            .filter(q => q.answer)
            .map(q => ({ question: q.question, answer: q.answer }));

        // Подсказки из селектов (могли быть сохранены ранее)
        const hints = {};
        const taskCountEl = document.getElementById('factoryTaskCount');
        const stepsEl = document.getElementById('factoryStepsPerTask');
        if (taskCountEl) hints.taskCount = parseInt(taskCountEl.value);
        if (stepsEl) hints.stepsPerTask = parseInt(stepsEl.value);

        document.getElementById('btnGenerate').disabled = true;
        document.getElementById('factoryStatus').innerHTML =
            '<div style="color:var(--yellow);">⏳ LLM генерирует .kosmos.md...</div>';

        try {
            const res = await app.api('/generate', {
                method: 'POST',
                body: { goal: this.goal, answers, hints }
            });

            if (res.success && res.content) {
                this.generated = res.content;
                this.resultFilename = res.filename;
                document.getElementById('factoryStatus').innerHTML = '';
                this.renderResult(res.filename);
            } else {
                // LLM ошибка — fallback
                document.getElementById('factoryStatus').innerHTML =
                    `<div style="color:var(--text2);font-size:12px;">LLM ошибка: ${res.error || '?'}. Использую шаблон...</div>`;
                await this.generateFallback();
            }
        } catch (err) {
            document.getElementById('factoryStatus').innerHTML =
                `<div style="color:var(--text2);font-size:12px;">Ошибка: ${err.message}. Использую шаблон...</div>`;
            await this.generateFallback();
        }
    },

    // === FALLBACK: шаблон без LLM ===
    async generateFallback() {
        const taskCount = 2, stepsPerTask = 2;
        const content = this.generateTemplate(this.goal, taskCount, stepsPerTask);
        const slug = this.goal.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
        let filename = `${slug}.kosmos.md`;

        try {
            const saveRes = await app.api('/files', {
                method: 'POST',
                body: { filename, content }
            });
            if (!saveRes.success) {
                filename = `${slug}-${Date.now()}.kosmos.md`;
                await app.api('/files', {
                    method: 'POST',
                    body: { filename, content }
                });
            }
            this.generated = content;
            this.resultFilename = filename;
            this.renderResult(filename);
        } catch (err) {
            app.toast('Ошибка сохранения: ' + err.message, 'error');
        }
    },

    // === РЕЗУЛЬТАТ ===
    renderResult(filename) {
        const el = document.getElementById('factoryResult');
        el.innerHTML = `
            <div class="validation-ok" style="margin-bottom:12px;">
                ✅ Файл <strong>${app.escapeHtml(filename)}</strong> создан!
            </div>
            <div class="btn-group">
                <button class="btn btn-primary" onclick="app.navigate('task', '${filename}')">
                    ▶ Открыть и запустить
                </button>
                <button class="btn btn-secondary" onclick="FactoryPage.render(document.getElementById('mainContent'))">
                    🏭 Создать ещё
                </button>
            </div>
            <details style="margin-top:12px;">
                <summary style="cursor:pointer;color:var(--accent);font-size:13px;">Предпросмотр файла</summary>
                <div style="margin-top:8px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:16px;font-family:monospace;font-size:12px;white-space:pre-wrap;max-height:400px;overflow-y:auto;color:var(--text2);">${app.escapeHtml(this.generated)}</div>
            </details>
        `;
    },

    // ================================================================
    // МОДАЛКА ПРОМПТОВ
    // ================================================================
    async showPrompt(type) {
        // type = 'questions' | 'generator'
        let promptData = this.promptsCache[type];

        if (!promptData) {
            try {
                const res = await app.api(`/llm/prompts/${type}`);
                if (res.success) {
                    promptData = { filename: res.filename, content: res.content };
                    this.promptsCache[type] = promptData;
                } else {
                    app.toast('Не удалось загрузить промпт: ' + res.error, 'error');
                    return;
                }
            } catch (err) {
                app.toast('Ошибка загрузки промпта: ' + err.message, 'error');
                return;
            }
        }

        const title = type === 'questions' ? 'Промпт: Уточняющие вопросы' : 'Промпт: Генерация .kosmos.md';

        // Создаём overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'promptModal';
        overlay.onclick = (e) => { if (e.target === overlay) FactoryPage.closeModal(); };

        overlay.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>📄 ${title} <span style="color:var(--text2);font-weight:400;font-size:12px;">(${promptData.filename})</span></h3>
                    <button class="modal-close" onclick="FactoryPage.closeModal()">×</button>
                </div>
                <div class="modal-body">${app.escapeHtml(promptData.content)}</div>
            </div>
        `;

        document.body.appendChild(overlay);
    },

    closeModal() {
        const modal = document.getElementById('promptModal');
        if (modal) modal.remove();
    },

    // ================================================================
    // ШАБЛОН (fallback)
    // ================================================================
    generateTemplate(goal, taskCount, stepsPerTask) {
        const today = new Date().toISOString().split('T')[0];
        const lines = [];

        lines.push(`# ${goal} .kosmos.md`);
        lines.push('');
        lines.push('**Статус:** in progress');
        lines.push('**Прогресс:** 0%');
        lines.push(`**Последнее обновление:** ${today}`);
        lines.push('');
        lines.push('## Краткое summary (пишется в конце)');
        lines.push('');
        lines.push('(пусто)');
        lines.push('');
        lines.push('## Цель');
        lines.push('');
        lines.push(goal);
        lines.push('');

        for (let t = 1; t <= taskCount; t++) {
            lines.push(`## Задача ${t}: Задача ${t}`);
            lines.push('');
            for (let s = 1; s <= stepsPerTask; s++) {
                const stepNum = (t - 1) * stepsPerTask + s;
                lines.push(`### Шаг ${stepNum}: Шаг ${s} задачи ${t}`);
                lines.push('- [ ] Выполнено');
                lines.push(' ```js executable');
                lines.push(`      console.log("Шаг ${stepNum}: Выполняется...");`);
                lines.push(`      // TODO: Реализовать логику шага`);
                lines.push(' ```');
                lines.push(`Ожидаемый результат: Результат шага ${stepNum}`);
                lines.push('');
                lines.push('Результат:');
                lines.push('(пусто)');
                lines.push('');
                lines.push('Верификация:');
                lines.push('- [ ] пройдена.');
                lines.push('');
            }
        }
        return lines.join('\n');
    }
};
