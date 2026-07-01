/**
 * history.js — Архив выполненных задач
 */

const HistoryPage = {
    files: [],

    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <h2>📦 История</h2>
            </div>
            <div class="page-body">
                <div id="historyList"><div class="empty-state"><div class="icon">⏳</div><h3>Загрузка...</h3></div></div>
            </div>`;

        await this.loadFiles();
    },

    async loadFiles() {
        const listRes = await app.api('/files');
        if (!listRes.success) {
            document.getElementById('historyList').innerHTML = `
                <div class="empty-state"><div class="icon">⚠️</div><h3>Ошибка</h3><p>${app.escapeHtml(listRes.error)}</p></div>`;
            return;
        }

        // Получаем все файлы с деталями
        const files = [];
        for (const f of listRes.files) {
            const parsed = await app.api(`/files/${encodeURIComponent(f.filename)}/parse`);
            if (parsed.success) {
                files.push({
                    filename: f.filename,
                    modified: f.modified,
                    size: f.size,
                    title: parsed.metadata.title || f.filename,
                    status: parsed.metadata.status || 'in progress',
                    progress: parsed.progress.progress || 0,
                    totalSteps: parsed.progress.totalSteps,
                    completedSteps: parsed.progress.completedSteps,
                    goal: parsed.goal || '',
                    tasks: parsed.tasks,
                    steps: parsed.steps
                });
            }
        }

        // Сортируем: сначала завершённые, потом по дате
        files.sort((a, b) => {
            if (a.status === 'done' && b.status !== 'done') return -1;
            if (a.status !== 'done' && b.status === 'done') return 1;
            return new Date(b.modified) - new Date(a.modified);
        });

        this.files = files;
        this.renderList();
    },

    renderList() {
        if (this.files.length === 0) {
            document.getElementById('historyList').innerHTML = `
                <div class="empty-state">
                    <div class="icon">📭</div>
                    <h3>История пуста</h3>
                    <p>Пока нет ни одного .kosmos.md файла.</p>
                </div>`;
            return;
        }

        const html = this.files.map(f => `
            <div class="card" style="margin-bottom:12px;cursor:pointer;" onclick="app.navigate('task', '${f.filename}')">
                <div class="card-header">
                    <div>
                        <span class="file-name">${app.escapeHtml(f.filename)}</span>
                        <span style="font-size:12px;color:var(--text2);margin-left:8px;">${app.escapeHtml(f.title)}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;">
                        <span class="badge ${f.status === 'done' ? 'badge-done' : 'badge-progress'}">${f.status}</span>
                        <span style="font-size:12px;color:var(--text2);">${f.progress}%</span>
                    </div>
                </div>
                <div class="card-body">
                    <div style="font-size:13px;color:var(--text2);margin-bottom:8px;">${app.escapeHtml(f.goal.slice(0, 150))}${f.goal.length > 150 ? '...' : ''}</div>
                    <div style="display:flex;gap:16px;font-size:12px;color:var(--text2);">
                        <span>📋 Задач: ${f.tasks.length}</span>
                        <span>⚡ Шагов: ${f.completedSteps}/${f.totalSteps}</span>
                        <span>📅 ${app.formatDate(f.modified)}</span>
                    </div>
                    <div style="margin-top:8px;">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width:${f.progress}%"></div>
                        </div>
                    </div>
                    ${f.status === 'done' ? `
                    <div style="margin-top:8px;">
                        <details>
                            <summary style="cursor:pointer;font-size:12px;color:var(--accent);">Показать результаты шагов</summary>
                            <div style="margin-top:8px;">
                                ${f.steps.map(s => `
                                    <div style="margin-bottom:6px;font-size:12px;">
                                        <span style="color:${s.completed ? 'var(--green)' : 'var(--yellow)'};">${s.completed ? '✓' : '○'}</span>
                                        <strong>Шаг ${s.num}:</strong> ${app.escapeHtml(s.title)}
                                        ${s.result ? `<div style="color:var(--text2);margin-left:20px;font-family:monospace;white-space:pre-wrap;">${app.escapeHtml(s.result.slice(0, 200))}</div>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </details>
                    </div>` : ''}
                </div>
            </div>
        `).join('');

        document.getElementById('historyList').innerHTML = html;
    }
};
