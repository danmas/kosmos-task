/**
 * task.js — Просмотр задачи: шаги, выполнение, прогресс
 */

const TaskPage = {
    filename: null,
    parsed: null,
    running: false,
    stepOutputs: {}, // stepNum -> { output, success }

    async render(container, filename) {
        if (!filename) {
            container.innerHTML = `
                <div class="page-header"><h2>Задача</h2></div>
                <div class="page-body">
                    <div class="empty-state">
                        <div class="icon">❓</div>
                        <h3>Файл не выбран</h3>
                        <p>Выберите задачу из списка.</p>
                        <br>
                        <button class="btn btn-primary" onclick="app.navigate('dashboard')">← К списку</button>
                    </div>
                </div>`;
            return;
        }

        this.filename = decodeURIComponent(filename);
        this.stepOutputs = {};
        this.running = false;

        container.innerHTML = `
            <div class="page-header">
                <div style="display:flex;align-items:center;gap:12px;">
                    <button class="btn btn-secondary" onclick="app.navigate('dashboard')">←</button>
                    <h2 id="taskTitle">${app.escapeHtml(this.filename)}</h2>
                </div>
                <div class="btn-group">
                    <button class="btn btn-secondary" onclick="TaskPage.reload()">🔄 Обновить</button>
                    <button class="btn btn-danger" onclick="TaskPage.deleteFile()">🗑 Удалить</button>
                </div>
            </div>
            <div class="task-layout" style="flex:1;overflow:hidden;">
                <div class="task-file" id="taskFile"><div class="empty-state"><div class="icon">⏳</div><h3>Загрузка...</h3></div></div>
                <div class="task-exec">
                    <div class="task-exec-header">⚡ Выполнение</div>
                    <div class="task-exec-body" id="taskExecBody"></div>
                    <div class="task-exec-controls">
                        <button class="btn btn-primary" id="btnRun" onclick="TaskPage.runAll()">▶ Запустить все</button>
                        <button class="btn btn-secondary" id="btnReset" onclick="TaskPage.reload()">↺ Сброс</button>
                    </div>
                </div>
            </div>`;

        // Регистрация WS обработчиков
        app.onWS('run_start', (msg) => this.onRunStart(msg));
        app.onWS('step_start', (msg) => this.onStepStart(msg));
        app.onWS('step_done', (msg) => this.onStepDone(msg));
        app.onWS('run_done', (msg) => this.onRunDone(msg));
        app.onWS('error', (msg) => {
            app.toast(msg.error, 'error');
            this.running = false;
            this.updateButtons();
        });

        await this.loadFile();
    },

    async loadFile() {
        const res = await app.api(`/files/${encodeURIComponent(this.filename)}/parse`);
        if (!res.success) {
            document.getElementById('taskFile').innerHTML = `
                <div class="empty-state"><div class="icon">⚠️</div><h3>Ошибка</h3><p>${app.escapeHtml(res.error)}</p></div>`;
            return;
        }

        this.parsed = res;
        document.getElementById('taskTitle').textContent = res.metadata.title || this.filename;
        this.renderFile();
        this.renderExecPanel();
    },

    renderFile() {
        const p = this.parsed;
        const el = document.getElementById('taskFile');
        const lines = [];

        const addLine = (text, cls, changed) => {
            lines.push(`<div class="md-line${changed ? ' changed' : ''}"><span class="${cls || ''}">${app.escapeHtml(text)}</span></div>`);
        };

        addLine(`# ${p.metadata.title || this.filename} .kosmos.md`, 'md-heading');
        addLine('');
        addLine(`**Статус:** ${p.metadata.status || 'in progress'}`, 'md-bold', p.metadata.status === 'done');
        addLine(`**Прогресс:** ${p.progress.progress}%`, 'md-bold', p.progress.progress > 0);
        addLine(`**Последнее обновление:** ${p.metadata.lastUpdate || '—'}`, 'md-bold');
        addLine('');
        addLine('## Краткое summary (пишется в конце)', 'md-heading');
        addLine('(пусто)', 'md-empty');
        addLine('');
        addLine('## Цель', 'md-heading');
        addLine('');
        addLine(p.goal || '(не указана)');
        addLine('');

        // Группируем шаги по задачам
        const tasksMap = {};
        for (const step of p.steps) {
            const tn = step.taskNum;
            if (!tasksMap[tn]) tasksMap[tn] = [];
            tasksMap[tn].push(step);
        }

        for (const task of p.tasks) {
            addLine(`## Задача ${task.num}: ${task.title}`, 'md-heading');
            addLine('');

            const taskSteps = tasksMap[task.num] || [];
            for (const step of taskSteps) {
                addLine(`### Шаг ${step.num}: ${step.title}`, 'md-heading');
                const completed = step.completed || this.stepOutputs[step.num];
                addLine(completed ? '- [x] Выполнено' : '- [ ] Выполнено',
                    completed ? 'md-checkbox-done' : 'md-checkbox',
                    !!this.stepOutputs[step.num]);

                if (step.code) {
                    addLine(` \`\`\`${step.codeLang || 'js'} executable`, 'md-code-fence');
                    step.code.split('\n').forEach(l => addLine('      ' + l, 'md-code'));
                    addLine(' \`\`\`', 'md-code-fence');
                }

                addLine(`Ожидаемый результат: ${step.expected}`);
                addLine('');

                const output = this.stepOutputs[step.num];
                if (output) {
                    addLine('Результат:', '', true);
                    output.output.split('\n').forEach(l => addLine(l, 'md-result', true));
                } else if (step.result) {
                    addLine('Результат:');
                    step.result.split('\n').forEach(l => addLine(l, 'md-result'));
                } else {
                    addLine('Результат:');
                    addLine('(пусто)', 'md-empty');
                }
                addLine('');
                const verified = step.verificationPassed || (output && output.success);
                addLine('Верификация:', '', !!output);
                addLine(verified ? '- [x] пройдена.' : '- [ ] пройдена.',
                    verified ? 'md-checkbox-done' : 'md-checkbox',
                    !!output);
                addLine('');
            }
        }

        el.innerHTML = lines.join('\n');
    },

    renderExecPanel() {
        const body = document.getElementById('taskExecBody');
        const p = this.parsed;
        const steps = p.steps;

        let html = `
            <div class="progress-bar" style="margin-bottom:12px;">
                <div class="progress-fill" id="taskProgress" style="width:${p.progress.progress}%"></div>
            </div>`;

        for (const step of steps) {
            const output = this.stepOutputs[step.num];
            const isDone = step.completed || !!output;
            const stateClass = isDone ? 'done' : '';

            html += `
                <div class="step-card ${stateClass}" id="stepCard${step.num}">
                    <div class="step-card-header">
                        <div class="step-icon">${isDone ? '✓' : step.num}</div>
                        <span>Шаг ${step.num}: ${app.escapeHtml(step.title)}</span>
                    </div>
                    ${(isDone && (output || step.result)) ? `
                        <div class="step-output ${output && !output.success ? 'error' : ''}">${
                            app.escapeHtml(output ? output.output : (step.result || ''))
                        }</div>` : ''}
                </div>`;
        }

        body.innerHTML = html;
    },

    // === WS HANDLERS ===
    onRunStart(msg) {
        this.running = true;
        this.updateButtons();
        app.toast(`Запуск: ${msg.pendingSteps} шагов...`, 'success');
    },

    onStepStart(msg) {
        const card = document.getElementById(`stepCard${msg.stepNum}`);
        if (card) {
            card.className = 'step-card active';
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    onStepDone(msg) {
        this.stepOutputs[msg.stepNum] = {
            output: msg.output || (msg.error ? `ОШИБКА: ${msg.error}` : '(нет вывода)'),
            success: msg.success
        };

        const card = document.getElementById(`stepCard${msg.stepNum}`);
        if (card) {
            card.className = 'step-card done';
            // Добавляем вывод
            const body = card.querySelector('.step-card-header');
            if (body && !card.querySelector('.step-output')) {
                const outDiv = document.createElement('div');
                outDiv.className = `step-output ${msg.success ? '' : 'error'}`;
                outDiv.textContent = msg.output || (msg.error ? `ОШИБКА: ${msg.error}` : '');
                card.appendChild(outDiv);
            }
        }

        // Обновляем прогресс
        const progEl = document.getElementById('taskProgress');
        if (progEl && msg.progress !== undefined) {
            progEl.style.width = msg.progress + '%';
        }

        // Обновляем файловое представление
        this.renderFile();
    },

    onRunDone(msg) {
        this.running = false;
        this.updateButtons();
        app.toast(`Выполнение завершено: ${msg.progress}%`, 'success');
        // Полная перезагрузка данных
        this.loadFile();
    },

    updateButtons() {
        const btnRun = document.getElementById('btnRun');
        if (btnRun) {
            btnRun.disabled = this.running;
            btnRun.textContent = this.running ? '⏳ Выполняется...' : '▶ Запустить все';
        }
    },

    // === ACTIONS ===
    runAll() {
        if (this.running) return;
        app.wsSend({ action: 'run_all', filename: this.filename });
    },

    async reload() {
        this.stepOutputs = {};
        await this.loadFile();
    },

    async deleteFile() {
        if (!confirm(`Удалить файл "${this.filename}"?`)) return;
        const res = await app.api(`/files/${encodeURIComponent(this.filename)}`, { method: 'DELETE' });
        if (res.success) {
            app.toast('Файл удалён', 'success');
            app.navigate('dashboard');
        } else {
            app.toast('Ошибка: ' + res.error, 'error');
        }
    }
};
