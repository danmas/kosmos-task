/**
 * dashboard.js — Список задач с фильтрами
 */

const DashboardPage = {
    files: [],
    filter: 'all', // all | in progress | done
    dataDir: '',

    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <h2>📋 Задачи</h2>
                <div class="btn-group">
                    <button class="btn btn-primary" onclick="app.navigate('editor')">+ Новая задача</button>
                </div>
            </div>
            <div class="data-dir-panel" id="dataDirPanel" style="padding:8px 16px;background:var(--bg2, #1e1e2e);border-bottom:1px solid var(--border, #333);display:flex;align-items:center;gap:8px;font-size:13px;">
                <span style="color:var(--text2, #aaa);white-space:nowrap;">📁 Папка данных:</span>
                <input id="dataDirInput" type="text" value=""
                    style="flex:1;background:var(--bg3, #2a2a3a);border:1px solid var(--border, #444);border-radius:4px;padding:4px 8px;color:var(--text, #eee);font-size:13px;font-family:monospace;">
                <button class="btn btn-secondary" id="dataDirSaveBtn" onclick="DashboardPage.saveDataDir()" style="padding:4px 12px;font-size:12px;white-space:nowrap;">💾 Сохранить</button>
            </div>
            <div class="page-body">
                <div class="filter-tabs" id="filterTabs">
                    <div class="filter-tab active" data-filter="all" onclick="DashboardPage.setFilter('all')">Все</div>
                    <div class="filter-tab" data-filter="in progress" onclick="DashboardPage.setFilter('in progress')">В работе</div>
                    <div class="filter-tab" data-filter="done" onclick="DashboardPage.setFilter('done')">Завершённые</div>
                </div>
                <div id="fileList"><div class="empty-state"><div class="icon">⏳</div><h3>Загрузка...</h3></div></div>
            </div>
        `;

        await Promise.all([this.loadDataDir(), this.loadFiles()]);
    },

    async loadDataDir() {
        try {
            const res = await app.api('/config/data-dir');
            if (res.success) {
                this.dataDir = res.dataDir;
                const input = document.getElementById('dataDirInput');
                if (input) input.value = res.dataDir;
            }
        } catch {}
    },

    async saveDataDir() {
        const input = document.getElementById('dataDirInput');
        const newPath = input ? input.value.trim() : '';
        if (!newPath) return;

        const res = await app.api('/config/data-dir', {
            method: 'PUT',
            body: { dataDir: newPath }
        });

        if (res.success) {
            this.dataDir = res.dataDir;
            if (input) input.value = res.dataDir;
            app.toast('Путь сохранён: ' + res.dataDir, 'success');
            // Перезагружаем список файлов из новой папки
            await this.loadFiles();
        } else {
            app.toast('Ошибка: ' + res.error, 'error');
        }
    },

    async loadFiles() {
        const listRes = await app.api('/files');
        if (!listRes.success) {
            document.getElementById('fileList').innerHTML = `
                <div class="empty-state">
                    <div class="icon">⚠️</div>
                    <h3>Ошибка загрузки</h3>
                    <p>${app.escapeHtml(listRes.error)}</p>
                </div>`;
            return;
        }

        // Получаем метаданные для каждого файла
        const filesWithMeta = [];
        for (const f of listRes.files) {
            const progRes = await app.api(`/files/${encodeURIComponent(f.filename)}/progress`);
            filesWithMeta.push({
                ...f,
                title: progRes.title || f.filename,
                status: progRes.status || 'in progress',
                progress: progRes.progress || 0,
                totalSteps: progRes.totalSteps || 0,
                completedSteps: progRes.completedSteps || 0
            });
        }

        this.files = filesWithMeta;
        this.renderList();
    },

    setFilter(filter) {
        this.filter = filter;
        document.querySelectorAll('.filter-tab').forEach(el => {
            el.classList.toggle('active', el.dataset.filter === filter);
        });
        this.renderList();
    },

    renderList() {
        const filtered = this.filter === 'all'
            ? this.files
            : this.files.filter(f => f.status === this.filter);

        if (filtered.length === 0) {
            document.getElementById('fileList').innerHTML = `
                <div class="empty-state">
                    <div class="icon">📭</div>
                    <h3>Нет задач</h3>
                    <p>Создайте новую задачу вручную или через фабрику.</p>
                    <br>
                    <div class="btn-group" style="justify-content:center;">
                        <button class="btn btn-primary" onclick="app.navigate('editor')">+ Создать</button>
                        <button class="btn btn-purple" onclick="app.navigate('factory')">🏭 Фабрика</button>
                    </div>
                </div>`;
            return;
        }

        const html = `<div class="file-list">${filtered.map(f => `
            <div class="file-row" onclick="app.navigate('task', '${f.filename}')">
                <div>
                    <div class="file-name">${app.escapeHtml(f.filename)}</div>
                    <div style="font-size:12px;color:var(--text2);margin-top:2px;">${app.escapeHtml(f.title)}</div>
                </div>
                <div class="file-meta">
                    <span class="badge ${f.status === 'done' ? 'badge-done' : 'badge-progress'}">${f.status}</span>
                </div>
                <div class="file-meta">
                    <div class="progress-bar" style="width:80px;margin:0 auto;">
                        <div class="progress-fill" style="width:${f.progress}%"></div>
                    </div>
                    <div style="font-size:11px;margin-top:2px;">${f.progress}%</div>
                </div>
                <div class="file-meta">${f.completedSteps}/${f.totalSteps} шагов</div>
                <div class="file-meta">${app.formatDate(f.modified)}</div>
            </div>
        `).join('')}</div>`;

        document.getElementById('fileList').innerHTML = html;
    }
};
