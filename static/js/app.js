/**
 * App.js — SPA Router, API helpers, global utilities
 */

/* Theme initializer — runs immediately to prevent flash */
(function () {
    const saved = localStorage.getItem('app_theme') || 'system';
    document.documentElement.setAttribute('data-theme', saved);
})();

window.IdeaApp = (() => {
    // ── Auth & State ──────────────────────────────────────────
    let currentUser = null;

    function getToken() {
        return localStorage.getItem('auth_token');
    }

    function setToken(token) {
        if (token) localStorage.setItem('auth_token', token);
        else localStorage.removeItem('auth_token');
    }

    // ── API Helpers ──────────────────────────────────────────
    const API = '/api';

    async function apiFetch(path, opts = {}) {
        const headers = { 'Content-Type': 'application/json', ...opts.headers };
        const token = getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${API}${path}`, {
            headers,
            ...opts,
        });
        if (res.status === 401 && path !== '/auth/me' && path !== '/auth/login' && path !== '/auth/register') {
            // Unauthorized - force login
            setToken(null);
            showAuthModal();
            throw new Error('Unauthorized');
        }
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
        getChatHistory: (valId) => apiFetch(`/validations/${valId}/chat`),
        postChatMessage: (valId, content) => apiFetch(`/validations/${valId}/chat`, { method: 'POST', body: JSON.stringify({ content }) }),
        rebuildIdea: (ideaId, suggestion) => apiFetch(`/ideas/${ideaId}/rebuild`, { method: 'POST', body: JSON.stringify({ user_suggestion: suggestion }) }),

        getTabs: (ideaId) => apiFetch(`/ideas/${ideaId}/tabs`),
        createTab: (ideaId, data) => apiFetch(`/ideas/${ideaId}/tabs`, { method: 'POST', body: JSON.stringify(data) }),
        deleteTab: (tabId) => apiFetch(`/tabs/${tabId}`, { method: 'DELETE' }),
        createBlock: (tabId, data) => apiFetch(`/tabs/${tabId}/blocks`, { method: 'POST', body: JSON.stringify(data) }),
        updateBlock: (blockId, data) => apiFetch(`/blocks/${blockId}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteBlock: (blockId) => apiFetch(`/blocks/${blockId}`, { method: 'DELETE' }),

        // V2 OS Financials
        getFinancialPlan: (ideaId, data) => apiFetch(`/ideas/${ideaId}/financial-plan`, { method: 'POST', body: JSON.stringify(data) }),

        login: async (email, password) => {
            // OAuth2 requires form-urlencoded data
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Login failed');
            }
            return res.json();
        },
        register: (data) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
        getMe: () => apiFetch('/auth/me')
    };

    // ── Router ──────────────────────────────────────────────
    let currentRoute = '';
    let activeIdeaId = localStorage.getItem('active_idea_id') || null;

    async function initRouter() {
        try {
            if (getToken()) {
                currentUser = await api.getMe();
                hideAuthModal();
                renderApp();
            } else {
                showAuthModal();
            }
        } catch (err) {
            showAuthModal();
        }
    }

    function renderApp() {
        // App is authenticated, start routing
        window.addEventListener('hashchange', handleRoute);
        handleRoute();

        const usernameEl = document.getElementById('navUsername');
        if (usernameEl && currentUser) {
            usernameEl.textContent = currentUser.name.split(' ')[0];
        }
    }

    function setActiveIdea(id) {
        activeIdeaId = id;
        if (id) localStorage.setItem('active_idea_id', id);
        else localStorage.removeItem('active_idea_id');
    }

    function handleRoute() {
        const hash = window.location.hash || '#/';
        const path = hash.slice(1);
        currentRoute = path;

        // Update nav links
        document.querySelectorAll('.sidebar-link').forEach(link => {
            const linkRoute = link.dataset.route;
            const isActive = linkRoute === path ||
                (path === '/' && linkRoute === '/') ||
                (path.startsWith('/idea/') && linkRoute === '/');
            link.classList.toggle('active', isActive);
        });

        // Cleanup any view-specific intervals if they exist
        if (window.Settings && window.Settings.cleanup) {
            window.Settings.cleanup();
        }

        // Destroy global sticky notes when leaving idea context
        if (window.StickyNotes && window.StickyNotes.destroy) {
            if (path === '/' || path === '' || path === '/settings') {
                window.StickyNotes.destroy();
            }
        }

        // Contextual Redirection: If viewing a specific module but no idea is active
        const ideaModules = ['/workspace', '/validation', '/financials', '/risks', '/execution', '/meetings', '/expenses', '/journal', '/tests'];
        if (ideaModules.includes(path) && !activeIdeaId) {
            window.location.hash = '#/';
            return;
        }

        // Route Table
        if (path === '/' || path === '') {
            window.Dashboard.render();
        } else if (path.startsWith('/idea/')) {
            const id = parseInt(path.split('/')[2]);
            setActiveIdea(id);
            window.IdeaDetail.render(id);
        } else if (ideaModules.includes(path)) {
            // Render specific tab within the active idea
            window.IdeaDetail.render(activeIdeaId, path.slice(1));
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

    // ── Auth Modal Logic ────────────────────────────────────

    function showAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.classList.add('open');
            // Disable closing by clicking outside because auth is required
            modal.onclick = null;
        }
        const userNav = document.getElementById('userProfileNav');
        if (userNav) userNav.style.display = 'none';
    }

    function hideAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) modal.classList.remove('open');
        const userNav = document.getElementById('userProfileNav');
        if (userNav) userNav.style.display = 'flex';
    }

    function toggleAuthView(view) {
        const loginForm = document.getElementById('loginForm');
        const regForm = document.getElementById('registerForm');

        if (view === 'register') {
            loginForm.style.display = 'none';
            regForm.style.display = 'block';
        } else {
            loginForm.style.display = 'block';
            regForm.style.display = 'none';
        }
    }

    async function submitLogin(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const btn = document.getElementById('btnLogin');

        try {
            btn.disabled = true;
            btn.textContent = 'Signing in...';

            const res = await api.login(email, password);
            setToken(res.access_token);
            toast('Successfully signed in', 'success');

            // Reload user data and start app
            await initRouter();
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Sign In';
        }
    }

    async function submitRegister(e) {
        e.preventDefault();
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const btn = document.getElementById('btnRegister');

        try {
            btn.disabled = true;
            btn.textContent = 'Creating Workspace...';

            const res = await api.register({ name, email, password });
            setToken(res.access_token);
            toast('Workspace created successfully', 'success');

            // Reload user data and start app
            await initRouter();
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create Workspace';
        }
    }

    function logout() {
        setToken(null);
        currentUser = null;
        // Optionally redirect to home or just show modal
        window.location.hash = '#/';
        showAuthModal();
        toast('Logged out successfully', 'info');
    }

    let currentWizardStep = 1;

    function showNewIdeaModal() {
        currentWizardStep = 1;
        updateWizardUI();
        document.getElementById('newIdeaModal').classList.add('open');
        setTimeout(() => document.getElementById('intake-title').focus(), 100);
    }

    function closeNewIdeaModal() {
        document.getElementById('newIdeaModal').classList.remove('open');
        document.getElementById('newIdeaForm').reset();
        currentWizardStep = 1;
    }

    function updateWizardUI() {
        // Toggle steps
        for (let i = 1; i <= 4; i++) {
            document.getElementById(`wizard-step-${i}`).style.display = (i === currentWizardStep) ? 'block' : 'none';
            const dot = document.getElementById(`step-dot-${i}`);
            if (i <= currentWizardStep) {
                dot.style.background = 'var(--primary)';
            } else {
                dot.style.background = 'var(--border)';
            }
        }

        // Toggle buttons
        const prevBtn = document.getElementById('btn-wizard-prev');
        const nextBtn = document.getElementById('btn-wizard-next');
        const submitBtn = document.getElementById('btn-wizard-submit');

        prevBtn.style.visibility = (currentWizardStep > 1) ? 'visible' : 'hidden';

        if (currentWizardStep === 4) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'block';
        } else {
            nextBtn.style.display = 'block';
            submitBtn.style.display = 'none';
        }
    }

    function validateCurrentStep() {
        const step = document.getElementById(`wizard-step-${currentWizardStep}`);
        const inputs = step.querySelectorAll('input[required], textarea[required]');
        for (let input of inputs) {
            if (!input.value.trim()) {
                input.reportValidity();
                return false;
            }
        }
        return true;
    }

    function wizardNext() {
        if (!validateCurrentStep()) return;
        if (currentWizardStep < 4) {
            currentWizardStep++;
            updateWizardUI();
        }
    }

    function wizardPrev() {
        if (currentWizardStep > 1) {
            currentWizardStep--;
            updateWizardUI();
        }
    }

    async function submitNewIdea(e) {
        e.preventDefault();
        if (!validateCurrentStep()) return;

        const title = document.getElementById('intake-title').value.trim();
        const problem = document.getElementById('intake-problem').value.trim();
        const solution = document.getElementById('intake-solution').value.trim();

        const selectedTiers = Array.from(document.querySelectorAll('input[name="intake-tier"]:checked')).map(el => el.value);
        const selectedRevenueTypes = Array.from(document.querySelectorAll('input[name="intake-revenue-type"]:checked')).map(el => el.value);

        const structured_input = {
            title: title,
            core_concept: {
                problem: problem,
                solution: solution
            },
            target_audience: {
                type: document.getElementById('intake-audience-type').value,
                location: document.getElementById('intake-location').value.trim(),
                tier: selectedTiers,
                age_group: document.getElementById('intake-age').value.trim()
            },
            revenue_model: {
                type: selectedRevenueTypes,
                expected_price: document.getElementById('intake-price').value.trim()
            },
            competitor_awareness: document.getElementById('intake-competitors').value.trim(),
            market_trends: document.getElementById('intake-trends').value.trim(),
            onboarding_strategy: document.getElementById('intake-onboarding').value.trim(),
            risk_perception: document.getElementById('intake-risks').value.trim()
        };

        // Create a fallback description for older UI views
        const tiersStr = selectedTiers.length > 0 ? selectedTiers.join(', ') : 'All Tiers';
        const description = `Problem: ${problem}\nSolution: ${solution}\nAudience: ${structured_input.target_audience.type} in ${tiersStr} ${structured_input.target_audience.location}`;

        const btn = document.getElementById('btn-wizard-submit');
        btn.disabled = true;
        btn.textContent = 'Creating…';

        try {
            const idea = await api.createIdea({ title, description, structured_input });
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
        wizardNext,
        wizardPrev,
        toggleActivityDrawer,
        closeActivityDrawer,
        showAuthModal,
        hideAuthModal,
        toggleAuthView,
        submitLogin,
        submitRegister,
        logout,
        esc
    };
})();
