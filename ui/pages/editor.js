/**
 * editor.js — Создание и редактирование .kosmos.md файлов
 */

const EditorPage = {
    filename: null,
    mode: 'create', // create | edit
    content: '',

    async render(container, editFilename) {
        this.filename = editFilename ? decodeURIComponent(editFilename) : null;
        this.mode = this.filename ? 'edit' : 'create';

        container.innerHTML = `
            <div class="page-header">
                <div style="display:flex;align-items:center;gap:12px;">
                    <button class="btn btn-secondary" onclick="app.navigate('dashboard')">←</button>
                    <h2>✏️ ${this.mode === 'edit' ? 'Редактирование' : 'Новая задача'}</h2>
                </div>
                <div class="btn-group">
                    <button class="btn btn-secondary" onclick="EditorPage.validate()">✓ Валидация</button>
                    <button class="btn btn-primary" id="btnSave" onclick="EditorPage.save()">💾 Сохранить</button>
                </div>
            </div>
            <div class="page-body">
                <div id="validationResult" style="margin-bottom:12px;"></div>
                ${this.mode === 'create' ? `
                <div class="form-group" style="max-width:400px;margin-bottom:16px;">
                    <label>Имя файла</label>
                    <input type="text" class="form-input" id="editorFilename"
                        placeholder="my-task.kosmos.md" value="">
                </div>` : `
                <div style="font-size:13px;color:var(--text2);margin-bottom:12px;">
                    Файл: <span class="file-name">${app.escapeHtml(this.filename)}</span>
                </div>`}
                <div class="form-group">
                    <textarea class="form-textarea" id="editorContent"
                        style="min-height:calc(100vh - 300px);"
                        placeholder="# Название .kosmos.md\n\n**Статус:** in progress\n**Прогресс:** 0%\n**Последнее обновление:** ${new Date().toISOString().split('T')[0]}\n\n## Цель\n\n...\n\n## Задача 1: Название\n\n### Шаг 1: Название\n- [ ] Выполнено\n \`\`\`js executable\n      console.log('Hello');\n \`\`\`\nОжидаемый результат: ...\n\nРезультат:\n(пусто)\n\nВерификация:\n- [ ] пройдена.">${this.content}</textarea>
                </div>
            </div>`;

        // Если режим редактирования — загружаем файл
        if (this.mode === 'edit') {
            await this.loadFile();
        } else {
            // Вставляем шаблон
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('editorContent').value =
`# Новая задача .kosmos.md

**Статус:** in progress
**Прогресс:** 0%
**Последнее обновление:** ${today}

## Краткое summary (пишется в конце)

(пусто)

## Цель

Описание цели проекта.

## Задача 1: Название задачи

### Шаг 1: Название шага
- [ ] Выполнено
 \`\`\`js executable
      console.log("Hello, Kosmos!");
 \`\`\`
Ожидаемый результат: Описание ожидаемого результата

Результат:
(пусто)

Верификация:
- [ ] пройдена.
`;
        }
    },

    async loadFile() {
        const res = await app.api(`/files/${encodeURIComponent(this.filename)}`);
        if (res.success) {
            this.content = res.content;
            document.getElementById('editorContent').value = res.content;
        } else {
            app.toast('Ошибка загрузки: ' + res.error, 'error');
        }
    },

    async validate() {
        const content = document.getElementById('editorContent').value;
        const resultEl = document.getElementById('validationResult');

        if (!content.trim()) {
            resultEl.innerHTML = '<div class="validation-err">Файл пуст</div>';
            return;
        }

        const res = await app.api('/files/validate', {
            method: 'POST',
            body: { content }
        });

        if (res.success && res.valid) {
            resultEl.innerHTML = `<div class="validation-ok">✓ Файл валиден. Структура корректна.</div>`;
        } else if (res.success && !res.valid) {
            const errors = (res.errors || []).map(e => `• ${app.escapeHtml(e)}`).join('<br>');
            resultEl.innerHTML = `<div class="validation-err">✖ Ошибки:<br>${errors}</div>`;
        } else {
            resultEl.innerHTML = `<div class="validation-err">Ошибка валидации: ${app.escapeHtml(res.error || 'неизвестная ошибка')}</div>`;
        }
    },

    async save() {
        const content = document.getElementById('editorContent').value;

        if (!content.trim()) {
            app.toast('Файл пуст', 'error');
            return;
        }

        let filename = this.filename;

        if (this.mode === 'create') {
            filename = document.getElementById('editorFilename').value.trim();
            if (!filename) {
                app.toast('Укажите имя файла', 'error');
                return;
            }
            if (!filename.endsWith('.kosmos.md')) {
                filename += '.kosmos.md';
            }
        }

        const method = this.mode === 'create' ? 'POST' : 'PUT';
        const body = this.mode === 'create'
            ? { filename, content }
            : { content };

        const url = this.mode === 'create'
            ? '/files'
            : `/files/${encodeURIComponent(filename)}`;

        const res = await app.api(url, { method, body });

        if (res.success) {
            app.toast(`Файл ${this.mode === 'create' ? 'создан' : 'сохранён'}: ${filename}`, 'success');
            app.navigate('task', filename);
        } else {
            app.toast('Ошибка: ' + res.error, 'error');
        }
    }
};
