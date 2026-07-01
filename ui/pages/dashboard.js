/**
 * dashboard.js — Список задач с фильтрами
 */

const DashboardPage = {
    files: [],
    filter: 'all', // all | in progress | done

    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <h2>📋 Задачи</h2>
                <div class="btn-group">
                    <button class="btn btn-primary" onclick="app.navigate('editor')">+ Новая задача</button>
                </div>
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

        await this.loadFiles();
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
