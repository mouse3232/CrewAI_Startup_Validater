/**
 * js/experiments.js
 * Virtual-to-Reality Experiment Testing Dashboard
 */

window.Experiments = (() => {
    const app = () => window.IdeaApp;
    let currentIdeaId = null;

    async function init(ideaId, containerId) {
        currentIdeaId = ideaId;
        const container = document.getElementById(containerId);
        container.innerHTML = '<div style="text-align:center;padding:2rem"><div class="spinner" style="margin:0 auto"></div></div>';

        try {
            const exps = await app().apiFetch(`/ideas/${ideaId}/experiments`);
            renderExperiments(exps, container);
        } catch (err) {
            container.innerHTML = `<div class="card" style="text-align:center;color:var(--kill)">Failed to load experiments: ${app().esc(err.message)}</div>`;
        }
    }

    function renderExperiments(exps, container) {
        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
                <div>
                    <h2 style="font-size:1.25rem; font-weight:800; margin:0">Testing & Experiments</h2>
                    <p class="text-dim text-sm" style="margin-top:0.25rem">Define hypotheses and track real-world testing outcomes.</p>
                </div>
                <button class="btn btn-primary" onclick="window.Experiments.showNewExperimentModal()">+ Design Experiment</button>
            </div>
            
            <div class="exp-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(350px, 1fr)); gap:1.5rem">
                ${exps.length === 0 ? emptyState() : exps.map(e => expCard(e)).join('')}
            </div>
        `;
    }

    function emptyState() {
        return `
            <div class="card" style="grid-column:1/-1; text-align:center; padding:3rem">
                <div style="font-size:2rem; margin-bottom:1rem">🧪</div>
                <h3 style="margin-bottom:0.5rem">No active experiments</h3>
                <p class="text-dim text-sm">Design MVPs, customer surveys, or A/B tests to validate your business model.</p>
            </div>
        `;
    }

    function expCard(exp) {
        const statuses = {
            planned: { icon: '🗓️', color: 'var(--text-dim)', bg: 'var(--bg-alt)' },
            running: { icon: '⏳', color: '#1d4ed8', bg: '#dbeafe' },
            concluded: { icon: '✅', color: 'var(--go)', bg: '#dcfce7' }
        };
        const st = statuses[exp.status] || statuses.planned;

        return `
            <div class="card exp-card" style="display:flex; flex-direction:column; gap:1rem; position:relative; overflow:hidden">
                <div style="display:flex; justify-content:space-between; align-items:flex-start">
                    <span style="font-size:0.7rem; font-weight:700; text-transform:uppercase; padding:0.2rem 0.5rem; border-radius:6px; background:${st.bg}; color:${st.color}; display:flex; align-items:center; gap:0.25rem">
                        ${st.icon} ${app().esc(exp.status)}
                    </span>
                    <span class="text-xs text-dim">${app().esc(exp.timeframe)}</span>
                </div>
                
                <div>
                    <div class="text-xs text-dim" style="text-transform:uppercase; font-weight:700; margin-bottom:0.25rem">Hypothesis</div>
                    <div style="font-weight:600; font-size:1rem">${app().esc(exp.hypothesis)}</div>
                </div>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; padding:0.75rem; background:var(--bg-alt); border-radius:var(--radius)">
                    <div>
                        <div class="text-xs text-dim" style="text-transform:uppercase; font-weight:700; margin-bottom:0.15rem">Metric</div>
                        <div style="font-size:0.85rem; font-weight:600">${app().esc(exp.metric)}</div>
                    </div>
                    <div>
                        <div class="text-xs text-dim" style="text-transform:uppercase; font-weight:700; margin-bottom:0.15rem">Target</div>
                        <div style="font-size:0.85rem; font-weight:600">${app().esc(exp.target_criteria)}</div>
                    </div>
                </div>
                
                ${exp.outcome ? `
                <div style="margin-top:auto; padding-top:1rem; border-top:1px dashed var(--border-light)">
                    <div class="text-xs text-dim" style="text-transform:uppercase; font-weight:700; margin-bottom:0.35rem">Outcome</div>
                    <p style="font-size:0.85rem; margin:0; line-height:1.5">${app().esc(exp.outcome)}</p>
                </div>
                ` : ''}
            </div>
        `;
    }

    function showNewExperimentModal() {
        app().toast('Experiment design modal coming soon!', 'info');
    }

    return { init, showNewExperimentModal };
})();
