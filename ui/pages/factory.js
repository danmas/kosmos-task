/**
 * factory.js — Генерация .kosmos.md через фабрику
 */

const FactoryPage = {
    state: 'input', // input | generating | done
    generated: null,

    render(container) {
        container.innerHTML = `
            <div class="page-header">
                <h2>🏭 Фабрика задач</h2>
            </div>
            <div class="page-body" id="factoryBody">
            </div>`;

        this.state = 'input';
        this.renderInput();
    },

    renderInput() {
        const body = document.getElementById('factoryBody');
        body.innerHTML = `
            <div style="max-width:640px;">
                <p style="color:var(--text2);margin-bottom:20px;font-size:14px;">
                    Опишите цель задачи — фабрика сгенерирует готовый .kosmos.md файл с задачами и шагами.
                </p>

                <div class="form-group">
                    <label>Цель задачи</label>
                    <input type="text" class="form-input" id="factoryGoal"
                        placeholder="Например: Создать калькулятор Fibonacci с проверкой чётности"
                        style="font-size:16px;padding:12px;">
                </div>

                <div class="form-group">
                    <label>Количество задач</label>
                    <select class="form-input" id="factoryTaskCount" style="max-width:120px;">
                        <option value="1">1</option>
                        <option value="2" selected>2</option>
                        <option value="3">3</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Шагов на задачу</label>
                    <select class="form-input" id="factoryStepsPerTask" style="max-width:120px;">
                        <option value="1">1</option>
                        <option value="2" selected>2</option>
                        <option value="3">3</option>
                    </select>
                </div>

                <div class="btn-group">
                    <button class="btn btn-purple" id="btnGenerate" onclick="FactoryPage.generate()">
                        🏭 Сгенерировать
                    </button>
                </div>

                <div id="factoryStatus" style="margin-top:16px;"></div>
            </div>`;
    },

    async generate() {
        const goal = document.getElementById('factoryGoal').value.trim();
        if (!goal) {
            app.toast('Укажите цель задачи', 'error');
            return;
        }

        const taskCount = parseInt(document.getElementById('factoryTaskCount').value);
        const stepsPerTask = parseInt(document.getElementById('factoryStepsPerTask').value);

        document.getElementById('btnGenerate').disabled = true;
        document.getElementById('factoryStatus').innerHTML = '<div style="color:var(--yellow);">⏳ Генерация...</div>';

        // Пробуем LLM через API
        const llmRes = await app.api('/generate', {
            method: 'POST',
            body: { prompt: goal }
        });

        if (llmRes.success && llmRes.content) {
            // LLM сгенерировал — сохраняем
            this.generated = llmRes.content;
            this.showResult(llmRes.filename);
            return;
        }

        // Fallback — шаблонная генерация
        document.getElementById('factoryStatus').innerHTML =
            '<div style="color:var(--text2);font-size:12px;">LLM недоступен, использую шаблон...</div>';

        const content = this.generateTemplate(goal, taskCount, stepsPerTask);
        const slug = goal.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
        const filename = `${slug}.kosmos.md`;

        // Сохраняем через API
        const saveRes = await app.api('/files', {
            method: 'POST',
            body: { filename, content }
        });

        if (saveRes.success) {
            this.generated = content;
            app.toast('Файл создан: ' + filename, 'success');
            this.showResult(filename);
        } else {
            // Файл уже существует — добавим суффикс
            const altFilename = `${slug}-${Date.now()}.kosmos.md`;
            const altRes = await app.api('/files', {
                method: 'POST',
                body: { filename: altFilename, content }
            });
            if (altRes.success) {
                this.generated = content;
                app.toast('Файл создан: ' + altFilename, 'success');
                this.showResult(altFilename);
            } else {
                app.toast('Ошибка сохранения: ' + altRes.error, 'error');
                document.getElementById('btnGenerate').disabled = false;
            }
        }
    },

    showResult(filename) {
        const body = document.getElementById('factoryBody');
        body.innerHTML = `
            <div style="max-width:640px;">
                <div class="validation-ok" style="margin-bottom:16px;">
                    ✅ Файл <strong>${app.escapeHtml(filename)}</strong> успешно создан!
                </div>

                <div class="btn-group">
                    <button class="btn btn-primary" onclick="app.navigate('task', '${filename}')">
                        ▶ Открыть и запустить
                    </button>
                    <button class="btn btn-secondary" onclick="FactoryPage.render(document.getElementById('mainContent'))">
                        🏭 Создать ещё
                    </button>
                </div>

                <details style="margin-top:16px;">
                    <summary style="cursor:pointer;color:var(--accent);font-size:13px;">Предпросмотр файла</summary>
                    <div style="margin-top:8px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:16px;font-family:monospace;font-size:12px;white-space:pre-wrap;max-height:400px;overflow-y:auto;color:var(--text2);">${app.escapeHtml(this.generated)}</div>
                </details>
            </div>`;
    },

    /**
     * Шаблонная генерация .kosmos.md (fallback без LLM)
     */
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
