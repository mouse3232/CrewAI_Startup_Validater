/**
 * Settings.js — Application System Settings, Engine Selector, and AI Monitoring
 */

window.Settings = (() => {
    const $content = () => document.getElementById('appContent');
    let systemStatusTimer = null;
    let currentEngine = 'groq';

    async function render() {
        const el = $content();

        // Clean up any existing timer when re-rendering
        if (systemStatusTimer) clearInterval(systemStatusTimer);

        // Fetch current engine mode
        try {
            const res = await fetch('/api/system/engine');
            const data = await res.json();
            currentEngine = data.mode || 'groq';
        } catch (e) { currentEngine = 'groq'; }

        el.innerHTML = `
        <div style="max-width:960px;margin:0 auto;padding-top:1rem">
            <h1 style="font-size:1.75rem;font-weight:800;letter-spacing:-0.02em;margin-bottom:0.25rem">Settings</h1>
            <p class="text-dim text-sm" style="margin-bottom:2rem">Manage appearance, AI engine, model preferences, and monitor gateway connections.</p>
            
            <!-- Appearance / Theme -->
            <div class="card" style="margin-bottom:1.5rem;padding:1.25rem;">
                <h3 style="font-size:1.1rem;font-weight:700;margin:0 0 0.75rem 0;display:flex;align-items:center;gap:0.5rem;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                    Appearance
                </h3>
                <p class="text-dim text-sm" style="margin-bottom:1rem;">Choose your preferred color theme. "System" follows your OS preference.</p>
                <div class="theme-toggle" id="themeToggle">
                    <button onclick="window.Settings.setTheme('light')" class="${(localStorage.getItem('app_theme') || 'system') === 'light' ? 'active' : ''}">☀️ Light</button>
                    <button onclick="window.Settings.setTheme('dark')" class="${(localStorage.getItem('app_theme') || 'system') === 'dark' ? 'active' : ''}">🌙 Dark</button>
                    <button onclick="window.Settings.setTheme('system')" class="${(localStorage.getItem('app_theme') || 'system') === 'system' ? 'active' : ''}">💻 System</button>
                </div>
            </div>
            
            <!-- AI Engine Mode Selector -->
            <div class="card" style="margin-bottom:1.5rem;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#f8fafc;border:1px solid #334155;border-radius:12px;padding:1.5rem">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
                    <div>
                        <h3 style="font-size:1.1rem;font-weight:700;margin:0;color:#f8fafc;display:flex;align-items:center;gap:0.5rem">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                            AI Engine Mode
                        </h3>
                        <div class="text-xs" style="color:#94a3b8;margin-top:0.35rem">Select the primary inference backend. Only one engine can be active at a time.</div>
                    </div>
                    <div id="engineStatus" style="padding:0.35rem 0.75rem;border-radius:6px;font-size:0.75rem;font-weight:700;letter-spacing:0.03em;background:${currentEngine === 'gemini' ? '#1d4ed8' : '#047857'};color:#fff">
                        ${currentEngine.toUpperCase()} ACTIVE
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
                    <div id="engineCard-groq" onclick="window.Settings.switchEngine('groq')" style="cursor:pointer;padding:1.25rem;border-radius:10px;border:2px solid ${currentEngine === 'groq' ? '#10b981' : '#334155'};background:${currentEngine === 'groq' ? 'rgba(16,185,129,0.08)' : '#0f172a'};transition:all 0.3s">
                        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
                            <div style="width:12px;height:12px;border-radius:50%;border:2px solid ${currentEngine === 'groq' ? '#10b981' : '#475569'};display:flex;align-items:center;justify-content:center">
                                ${currentEngine === 'groq' ? '<div style="width:6px;height:6px;border-radius:50%;background:#10b981"></div>' : ''}
                            </div>
                            <span style="font-weight:700;font-size:0.95rem;color:#e2e8f0">Groq Multi-Model</span>
                        </div>
                        <div style="font-size:0.8rem;color:#94a3b8;line-height:1.45">14 specialized LLMs including GPT-OSS, LLaMA, Kimi, and safety guard models with multi-tier fallback cascading.</div>
                        <div style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap">
                            <span style="font-size:0.65rem;padding:0.2rem 0.5rem;border-radius:4px;background:#1e293b;color:#64748b;border:1px solid #334155">14 Models</span>
                            <span style="font-size:0.65rem;padding:0.2rem 0.5rem;border-radius:4px;background:#1e293b;color:#64748b;border:1px solid #334155">Web Search</span>
                            <span style="font-size:0.65rem;padding:0.2rem 0.5rem;border-radius:4px;background:#1e293b;color:#64748b;border:1px solid #334155">Safety Guards</span>
                        </div>
                    </div>
                    <div id="engineCard-gemini" onclick="window.Settings.switchEngine('gemini')" style="cursor:pointer;padding:1.25rem;border-radius:10px;border:2px solid ${currentEngine === 'gemini' ? '#3b82f6' : '#334155'};background:${currentEngine === 'gemini' ? 'rgba(59,130,246,0.08)' : '#0f172a'};transition:all 0.3s">
                        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
                            <div style="width:12px;height:12px;border-radius:50%;border:2px solid ${currentEngine === 'gemini' ? '#3b82f6' : '#475569'};display:flex;align-items:center;justify-content:center">
                                ${currentEngine === 'gemini' ? '<div style="width:6px;height:6px;border-radius:50%;background:#3b82f6"></div>' : ''}
                            </div>
                            <span style="font-weight:700;font-size:0.95rem;color:#e2e8f0">Google Gemini</span>
                        </div>
                        <div style="font-size:0.8rem;color:#94a3b8;line-height:1.45">5 Gemini models from Flash to Pro with native safety filters, deep reasoning, and search-augmented generation.</div>
                        <div style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap">
                            <span style="font-size:0.65rem;padding:0.2rem 0.5rem;border-radius:4px;background:#1e293b;color:#64748b;border:1px solid #334155">5 Models</span>
                            <span style="font-size:0.65rem;padding:0.2rem 0.5rem;border-radius:4px;background:#1e293b;color:#64748b;border:1px solid #334155">Native Safety</span>
                            <span style="font-size:0.65rem;padding:0.2rem 0.5rem;border-radius:4px;background:#1e293b;color:#64748b;border:1px solid #334155">Search+Reason</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- System Monitoring Dashboard -->
            <div class="card" style="margin-bottom:1.5rem;background:#0f172a;color:#f8fafc;border:1px solid #334155;border-radius:12px;padding:1.5rem">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem">
                    <div>
                        <h3 style="font-size:1.1rem;font-weight:700;margin:0;display:flex;align-items:center;gap:0.5rem;color:#f8fafc;">
                            <span style="position:relative;display:flex;width:10px;height:10px">
                                <span style="animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;position:absolute;display:inline-flex;height:100%;width:100%;border-radius:9999px;background-color:#10b981;opacity:0.75"></span>
                                <span style="position:relative;display:inline-flex;border-radius:9999px;height:10px;width:10px;background-color:#10b981"></span>
                            </span>
                            AI Gateway Orchestration Monitor
                        </h3>
                        <div class="text-dim text-xs mt-1" style="color:#94a3b8">Real-time LLM token consumption and rate-limiting. Model load balancing triggers automatically on 429 backoffs.</div>
                    </div>
                </div>
                <div id="systemMonitorGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem">
                    <div class="text-dim text-sm" style="color:#94a3b8">Connecting to Gateway Telemetry...</div>
                </div>
            </div>
            
        </div>
        `;

        fetchSystemStatus();
        systemStatusTimer = setInterval(fetchSystemStatus, 3000);
    }

    async function fetchSystemStatus() {
        const grid = document.getElementById('systemMonitorGrid');
        if (!grid) {
            if (systemStatusTimer) clearInterval(systemStatusTimer);
            return;
        }

        try {
            const res = await fetch('/api/system/models/status');
            const data = await res.json();

            if (data.models && data.models.length > 0) {
                grid.innerHTML = data.models.map(m => {
                    const colorMap = {
                        'green': '#10b981',
                        'yellow': '#f59e0b',
                        'red': '#ef4444',
                        'gray': '#64748b'
                    };
                    const color = colorMap[m.state] || '#10b981';

                    const toggleHtml = m.controlled ? `
                        <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid #334155;display:flex;justify-content:space-between;align-items:center">
                            <span class="text-xs" style="color:#94a3b8">Manual Override</span>
                            <label class="toggle-switch">
                                <input type="checkbox" onchange="window.Settings.toggleModel('${m.id}', this.checked)" ${!m.disabled ? 'checked' : ''}>
                                <span class="toggle-slider" style="background-color:${m.disabled ? '#334155' : 'var(--go)'}"></span>
                            </label>
                        </div>
                    ` : '';

                    const statusText = m.disabled ? 'Disabled by User' : (m.state === 'red' ? 'Rate Limited' : (m.state === 'yellow' ? 'Near Limit' : 'Active'));

                    return `
                    <div style="background:#1e293b;border:1px solid ${m.disabled ? '#334155' : '#475569'};border-radius:8px;padding:1rem;display:flex;flex-direction:column;gap:0.35rem;transition:all 0.2s;opacity:${m.disabled ? '0.6' : '1'}">
                        <div style="display:flex;justify-content:space-between;align-items:center">
                            <span style="font-weight:600;font-size:0.9rem;color:#e2e8f0">${m.id}</span>
                            <span style="width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color}"></span>
                        </div>
                        <div class="text-xs" style="color:#94a3b8;margin-bottom:0.25rem">${m.model_string}</div>
                        <div class="text-xs" style="color:${color};font-weight:600;margin-bottom:0.5rem">${statusText}</div>
                        
                        <div style="display:flex;justify-content:space-between;font-size:0.85rem">
                            <span style="color:#64748b">RPM:</span>
                            <span style="font-family:monospace;color:#e2e8f0">${m.rpm} <span style="color:#64748b">/ ${m.max_rpm || '∞'}</span></span>
                        </div>
                        
                        <div style="display:flex;justify-content:space-between;font-size:0.85rem">
                            <span style="color:#64748b">TPM:</span>
                            <span style="font-family:monospace;color:#e2e8f0">${(m.tpm / 1000).toFixed(1)}k <span style="color:#64748b">/ ${m.max_tpm ? (m.max_tpm / 1000).toFixed(1) + 'k' : '∞'}</span></span>
                        </div>
                        
                        ${m.disabled ? `<div style="margin-top:0.4rem;padding-top:0.4rem;border-top:1px solid #334155;font-size:0.75rem;color:#94a3b8">↳ Auto Fallback Mode Enabled</div>` : (m.state !== 'green' && m.fallback ? `<div style="margin-top:0.4rem;padding-top:0.4rem;border-top:1px solid #334155;font-size:0.75rem;color:#f59e0b">↳ Fallback: ${m.fallback}</div>` : '')}
                        
                        ${toggleHtml}
                    </div>
                    `;
                }).join('');
            }
        } catch (err) {
            console.warn('Failed to fetch system metrics:', err);
        }
    }

    async function toggleModel(modelId, isEnabled) {
        try {
            await fetch(`/api/system/models/${modelId}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: isEnabled })
            });
            fetchSystemStatus();
        } catch (err) {
            console.error('Failed to toggle model', err);
            fetchSystemStatus();
        }
    }

    async function switchEngine(mode) {
        if (mode === currentEngine) return;

        // Show loading state
        const status = document.getElementById('engineStatus');
        if (status) {
            status.textContent = 'SWITCHING...';
            status.style.background = '#475569';
        }

        try {
            const res = await fetch('/api/system/engine/switch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode })
            });
            const data = await res.json();

            if (res.ok) {
                currentEngine = mode;
                // Show toast
                if (window.IdeaApp && window.IdeaApp.toast) {
                    window.IdeaApp.toast(data.message || `AI Engine switched to ${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode.`, 'success');
                }
                // Re-render the entire settings page to refresh engine selector + monitor grid
                render();
            } else {
                if (window.IdeaApp && window.IdeaApp.toast) {
                    window.IdeaApp.toast(data.detail || 'Engine switch failed.', 'error');
                }
                // Restore status
                if (status) {
                    status.textContent = currentEngine.toUpperCase() + ' ACTIVE';
                    status.style.background = currentEngine === 'gemini' ? '#1d4ed8' : '#047857';
                }
            }
        } catch (err) {
            console.error('Failed to switch engine:', err);
            if (window.IdeaApp && window.IdeaApp.toast) {
                window.IdeaApp.toast('Engine switch failed. Check your API key.', 'error');
            }
            if (status) {
                status.textContent = currentEngine.toUpperCase() + ' ACTIVE';
                status.style.background = currentEngine === 'gemini' ? '#1d4ed8' : '#047857';
            }
        }
    }

    function setTheme(theme) {
        localStorage.setItem('app_theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
        // Update toggle active states
        const btns = document.querySelectorAll('#themeToggle button');
        btns.forEach(b => b.classList.remove('active'));
        const labels = { light: 0, dark: 1, system: 2 };
        if (btns[labels[theme]]) btns[labels[theme]].classList.add('active');
    }

    return {
        render,
        toggleModel,
        switchEngine,
        setTheme,
        cleanup: () => {
            if (systemStatusTimer) clearInterval(systemStatusTimer);
        }
    };
})();
