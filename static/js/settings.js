/**
 * Settings.js — Application System Settings and Monitoring
 */

window.Settings = (() => {
    const $content = () => document.getElementById('appContent');
    let systemStatusTimer = null;

    function render() {
        const el = $content();

        // Clean up any existing timer when re-rendering
        if (systemStatusTimer) clearInterval(systemStatusTimer);

        el.innerHTML = `
        <div style="max-width:960px;margin:0 auto;padding-top:1rem">
            <h1 style="font-size:1.75rem;font-weight:800;letter-spacing:-0.02em;margin-bottom:0.25rem">Settings</h1>
            <p class="text-dim text-sm" style="margin-bottom:2rem">Manage application preferences, view system diagnostics, and monitor AI gateway connections.</p>
            
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
                        <div class="text-dim text-xs mt-1" style="color:#94a3b8">Real-time LLM token consumption and rate-limiting limits. Model load balancing triggers automatically on 429 backoffs.</div>
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
                        'green': '#10b981', // safe
                        'yellow': '#f59e0b', // near limit
                        'red': '#ef4444', // throttled/fallback
                        'gray': '#64748b' // manually disabled
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
                            <span style="font-weight:600;font-size:0.9rem;color:#e2e8f0;display:flex;align-items:center;gap:0.5rem">
                                ${m.id}
                            </span>
                            <span style="width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color};display:flex;align-items:center;white-space:nowrap;gap:0.5rem"></span>
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
            fetchSystemStatus(); // trigger rapid refresh
        } catch (err) {
            console.error('Failed to toggle model', err);
            // Revert UI implicitly by fetching real truth immediately
            fetchSystemStatus();
        }
    }

    return {
        render,
        toggleModel,
        cleanup: () => {
            if (systemStatusTimer) clearInterval(systemStatusTimer);
        }
    };
})();
