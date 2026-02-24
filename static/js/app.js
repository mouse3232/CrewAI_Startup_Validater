/**
 * App.js — SPA Router, API helpers, global utilities
 */

window.IdeaApp = (() => {
    // ── API Helpers ──────────────────────────────────────────
    const API = '/api';

    async function apiFetch(path, opts = {}) {
        const res = await fetch(`${API}${path}`, {
            headers: { 'Content-Type': 'application/json', ...opts.headers },
            ...opts,
        });
        if (res.status === 204) return null;
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || 'Request failed');
        }
        return res.json();
    }

    const api = {
        listIdeas: () => apiFetch('/ideas'),
        createIdea: (data) => apiFetch('/ideas', { method: 'POST', body: JSON.stringify(data) }),
        getIdea: (id) => apiFetch(`/ideas/${id}`),
        updateIdea: (id, data) => apiFetch(`/ideas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteIdea: (id) => apiFetch(`/ideas/${id}`, { method: 'DELETE' }),
        validate: (id) => apiFetch(`/ideas/${id}/validate`, { method: 'POST' }),
        refine: (id) => apiFetch(`/ideas/${id}/refine`, { method: 'POST' }),
        compare: (ids) => apiFetch(`/ideas/compare?ids=${ids.join(',')}`),
        getCharts: (id) => apiFetch(`/ideas/${id}/charts`),
    };

    // ── Router ──────────────────────────────────────────────
    let currentRoute = '';

    function initRouter() {
        window.addEventListener('hashchange', handleRoute);
        handleRoute();
    }

    function handleRoute() {
        const hash = window.location.hash || '#/';
        const path = hash.slice(1);
        currentRoute = path;

        // Update nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.route === path ||
                (path.startsWith('/idea/') && link.dataset.route === '/'));
        });

        // Cleanup any view-specific intervals if they exist
        if (window.Settings && window.Settings.cleanup) {
            window.Settings.cleanup();
        }

        // Route
        if (path === '/' || path === '') {
            window.Dashboard.render();
        } else if (path.startsWith('/idea/')) {
            const id = parseInt(path.split('/')[2]);
            window.IdeaDetail.render(id);
        } else if (path === '/compare') {
            window.Comparison.render();
        } else if (path === '/glossary') {
            window.Glossary.render();
        } else if (path === '/settings') {
            window.Settings.render();
        } else {
            window.Dashboard.render();
        }
    }

    // ── Drawer & Modal ──────────────────────────────────────
    function toggleActivityDrawer() {
        const drawer = document.getElementById('activityDrawer');
        const overlay = document.getElementById('drawerOverlay');
        const container = document.getElementById('mainContainer');
        const isOpen = drawer.classList.contains('open');

        if (isOpen) {
            closeActivityDrawer();
        } else {
            drawer.classList.add('open');
            overlay.classList.add('open');
            container.classList.add('drawer-open');
        }
    }

    function closeActivityDrawer() {
        document.getElementById('activityDrawer').classList.remove('open');
        document.getElementById('drawerOverlay').classList.remove('open');
        document.getElementById('mainContainer').classList.remove('drawer-open');
    }

    function showNewIdeaModal() {
        document.getElementById('newIdeaModal').classList.add('open');
        document.getElementById('ideaTitle').focus();
    }

    function closeNewIdeaModal() {
        document.getElementById('newIdeaModal').classList.remove('open');
        document.getElementById('newIdeaForm').reset();
    }

    async function submitNewIdea(e) {
        e.preventDefault();
        const title = document.getElementById('ideaTitle').value.trim();
        const description = document.getElementById('ideaDescription').value.trim();
        if (!title || !description) return;

        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Creating…';

        try {
            const idea = await api.createIdea({ title, description });
            closeNewIdeaModal();
            toast('Idea created! Starting validation…', 'success');
            window.location.hash = `#/idea/${idea.id}`;
            // Auto-trigger validation
            setTimeout(() => window.IdeaDetail.startValidation(idea.id), 500);
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create & Validate';
        }
    }

    // ── Toast ───────────────────────────────────────────────
    function toast(msg, type = 'info') {
        const container = document.getElementById('toastContainer');
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = msg;
        container.appendChild(el);
        setTimeout(() => el.remove(), 4000);
    }

    // ── Decision helpers ────────────────────────────────────
    function decisionBadge(decision) {
        if (!decision) return '<span class="badge badge-draft">Pending</span>';
        const cls = decision === 'GO' ? 'go' : decision === 'IMPROVE' ? 'improve' : 'kill';
        return `<span class="badge badge-${cls}">${decision}</span>`;
    }

    function decisionClass(decision) {
        if (!decision) return 'draft';
        return decision === 'GO' ? 'go' : decision === 'IMPROVE' ? 'improve' : 'kill';
    }

    function scoreBarHTML(score, decision) {
        const pct = Math.min((score || 0) / 10 * 100, 100);
        const cls = decisionClass(decision);
        return `
            <div class="score-bar-container">
                <div class="score-bar-label">
                    <span class="text-dim text-xs">Score</span>
                    <span class="fw-700">${(score || 0).toFixed(1)}/10</span>
                </div>
                <div class="score-bar-track">
                    <div class="score-bar-fill ${cls}" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
    }

    function statusBadge(status) {
        if (status === 'validating') return '<span class="badge badge-validating"><span class="badge-dot"></span> Validating</span>';
        if (status === 'completed') return '<span class="badge badge-go">Completed</span>';
        return '<span class="badge badge-draft">Draft</span>';
    }

    function formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // ── Init ────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', initRouter);

    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    return {
        api,
        apiFetch,
        toast,
        decisionBadge,
        decisionClass,
        scoreBarHTML,
        statusBadge,
        formatDate,
        showNewIdeaModal,
        closeNewIdeaModal,
        submitNewIdea,
        toggleActivityDrawer,
        closeActivityDrawer,
    };
})();
