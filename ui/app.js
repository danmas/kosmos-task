/**
 * app.js — SPA роутер, API-клиент, WS-клиент
 */

const API = '/api';

const app = {
    currentPage: 'dashboard',
    currentFile: null,
    ws: null,
    wsHandlers: {},

    // === ИНИЦИАЛИЗАЦИЯ ===
    init() {
        this.connectWS();
        // Роутинг по hash
        window.addEventListener('hashchange', () => this.handleRoute());
        this.handleRoute();
        // Автопроверка AI при загрузке
        this.loadAiConfig().then(() => {
            setTimeout(() => this.checkAiHealth(true), 1500);
        });
    },

    handleRoute() {
        const hash = location.hash.slice(1) || 'dashboard';
        const [page, ...params] = hash.split('/');
        this.navigate(page, params.join('/'), false);
    },

    // === НАВИГАЦИЯ ===
    navigate(page, param, updateHash = true) {
        this.currentPage = page;
        this.currentFile = param || null;

        if (updateHash) {
            location.hash = param ? `${page}/${param}` : page;
        }

        // Обновляем сайдбар
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === page);
        });

        // Рендерим страницу
        const main = document.getElementById('mainContent');
        switch (page) {
            case 'dashboard': DashboardPage.render(main); break;
            case 'task':      TaskPage.render(main, this.currentFile); break;
            case 'factory':   FactoryPage.render(main); break;
            case 'editor':    EditorPage.render(main, this.currentFile); break;
            case 'history':   HistoryPage.render(main); break;
            default:          DashboardPage.render(main);
        }
    },

    // === API ===
    async api(path, opts = {}) {
        const url = `${API}${path}`;
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            ...opts,
            body: opts.body ? JSON.stringify(opts.body) : undefined
        });
        return res.json();
    },

    // === WEBSOCKET ===
    connectWS() {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${proto}//${location.host}/ws`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            document.getElementById('wsStatus').innerHTML = '🟢 WS: подключён';
        };

        this.ws.onclose = () => {
            document.getElementById('wsStatus').innerHTML = '🔴 WS: отключён';
            // Переподключение через 3 сек
            setTimeout(() => this.connectWS(), 3000);
        };

        this.ws.onerror = () => {
            document.getElementById('wsStatus').innerHTML = '🔴 WS: ошибка';
        };

        this.ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                // Вызываем зарегистрированный обработчик
                const handler = this.wsHandlers[msg.type];
                if (handler) handler(msg);
            } catch (err) {
                console.error('WS parse error:', err);
            }
        };
    },

    wsSend(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    },

    onWS(type, handler) {
        this.wsHandlers[type] = handler;
    },

    offWS(type) {
        delete this.wsHandlers[type];
    },

    // === TOAST ===
    toast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = message;
        container.appendChild(el);
        setTimeout(() => el.remove(), 4000);
    },

    // === УТИЛИТЫ ===
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    formatDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    },

    // === AI HEALTH CHECK ===
    _aiChecked: false,
    _aiModel: null,

    async loadAiConfig() {
        try {
            const res = await fetch(`${API}/llm/health`);
            const data = await res.json();
            this._aiModel = data.model || '?';
            const el = document.getElementById('aiStatus');
            if (el) el.innerHTML = `⚪ AI: ${this._aiModel} (не проверен)`;
        } catch {
            this._aiModel = '?';
        }
    },

    async checkAiHealth(isAuto = false) {
        const el = document.getElementById('aiStatus');
        const model = this._aiModel || '?';
        if (el) el.innerHTML = `🟡 AI: ${model} (проверка...)`;

        try {
            const res = await fetch(`${API}/ai-test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: 'OK' })
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok && data.success) {
                if (el) el.innerHTML = `🟢 AI: ${data.model} (${data.latencyMs}мс)`;
                console.log(`[AI Check] AI доступен: ${data.model}, ${data.latencyMs}мс`);
            } else {
                const errMsg = data.error || `HTTP ${res.status}`;
                const m = data.model || model;
                if (el) el.innerHTML = `🔴 AI: ${m} — ошибка`;
                console.warn('[AI Check] AI не отвечает:', errMsg);
                if (isAuto && !this._aiChecked) {
                    alert(`⚠️ AI не отвечает: ${errMsg}\n\nМодель: ${m}\nСервер: ${data.baseUrl || 'не настроен'}\n\nПроверьте доступность LLM-сервера.`);
                } else {
                    this.toast(`AI ошибка: ${errMsg}`, 'error');
                }
            }
            this._aiChecked = true;
        } catch (e) {
            if (el) el.innerHTML = `🔴 AI: ${model} — недоступен`;
            console.warn('[AI Check] Ошибка проверки AI:', e.message);
            if (isAuto && !this._aiChecked) {
                alert(`⚠️ AI недоступен: ${e.message}\n\nМодель: ${model}\nПроверьте настройки LLM_SERVER_URL в .env и доступность сервера.`);
            } else {
                this.toast('AI недоступен: ' + e.message, 'error');
            }
            this._aiChecked = true;
        }
    }
};
