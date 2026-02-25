/**
 * js/risks.js
 * Dedicated view for SWOT Analysis and Competitive Moats.
 */

window.Risks = (() => {
    let currentIdeaId = null;

    async function init(ideaId, containerId) {
        currentIdeaId = ideaId;
        const container = document.getElementById(containerId);
        container.innerHTML = '<div style="text-align:center;padding:2rem"><div class="spinner" style="margin:0 auto"></div></div>';

        try {
            const idea = await window.IdeaApp.api.getIdea(ideaId);
            const val = idea.validations && idea.validations.length > 0 ? idea.validations[0] : null;

            if (!val || !val.structured_idea) {
                container.innerHTML = emptyState();
                return;
            }

            renderRisks(val.structured_idea, container);
        } catch (err) {
            container.innerHTML = `<div class="card" style="text-align:center;color:var(--kill)">Failed to load risks: ${window.IdeaApp.esc(err.message)}</div>`;
        }
    }

    function emptyState() {
        return `
            <div class="card" style="text-align:center; padding:3rem">
                <div style="font-size:2rem; margin-bottom:1rem">🛡️</div>
                <h3 style="margin-bottom:0.5rem">No Analysis Available</h3>
                <p class="text-dim text-sm">Validate your idea to generate a comprehensive SWOT and Moat analysis.</p>
            </div>
        `;
    }

    function renderRisks(structuredData, container) {
        const agentOutputs = structuredData.agent_outputs || {};
        const riskData = agentOutputs['risk_inversion'] || {};

        // Categorized Risks
        const categories = riskData.risk_categorization || {
            'Market': [],
            'Financial': [],
            'Execution': [],
            'Regulatory': [],
            'Technology': []
        };

        // Moats Analysis
        const moats = riskData.moats_analysis || {
            'Brand': { score: 0, reasoning: 'Not assessed' },
            'NetworkEffects': { score: 0, reasoning: 'Not assessed' },
            'SwitchingCost': { score: 0, reasoning: 'Not assessed' },
            'DataAdvantage': { score: 0, reasoning: 'Not assessed' },
            'CapitalBarrier': { score: 0, reasoning: 'Not assessed' },
            'SpeedAdvantage': { score: 0, reasoning: 'Not assessed' }
        };

        let html = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h2 style="font-size:1.25rem; font-weight:800; margin:0">Risks & Moats Intelligence</h2>
                        <p class="text-dim text-sm" style="margin-top:0.25rem">Categorized risk mapping and defensive moat assessment.</p>
                    </div>
                    <button class="btn btn-outline btn-sm" onclick="window.Risks.regenerate()" style="display:flex; align-items:center; gap:0.4rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                        Refresh AI Deep Dive
                    </button>
                </div>
            </div>

            <!-- Risk Categories Grid -->
            <div class="swot-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                ${Object.entries(categories).map(([cat, list]) => `
                    <div class="card" style="border-top: 4px solid var(--${cat === 'Market' ? 'info' : cat === 'Financial' ? 'improve' : cat === 'Execution' ? 'primary' : cat === 'Regulatory' ? 'kill' : 'go'});">
                        <h4 class="text-xs fw-800" style="text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">${cat} Risks</h4>
                        <ul class="exec-list" style="padding:0; list-style:none; margin:0;">
                            ${Array.isArray(list) && list.length > 0 ? list.map(r => `
                                <li class="text-sm mb-1" style="display:flex; gap:0.5rem; align-items:flex-start;">
                                    <span style="color:var(--text-dim);">•</span>
                                    <span>${typeof r === 'string' ? window.IdeaApp.esc(r) : window.IdeaApp.esc(r.risk || 'Risk Alert')}</span>
                                </li>
                            `).join('') : '<li class="text-dim text-xs italic">Low risk identified</li>'}
                        </ul>
                    </div>
                `).join('')}
            </div>

            <!-- Moats Matrix -->
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid var(--border-light); padding-bottom:1rem;">
                    <h3 style="display:flex; align-items:center; gap: 0.5rem; margin:0;">
                         Defensibility & Moat Matrix
                    </h3>
                    <span class="badge badge-info">Strategic Defensibility Analysis</span>
                </div>
                
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:1.5rem;">
                    ${Object.entries(moats).map(([name, data]) => {
            const score = data.score || 0;
            const pct = (score / 10) * 100;
            const label = name.replace(/([A-Z])/g, ' $1').trim();
            return `
                        <div class="moat-item">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                                <span class="fw-700 text-sm">${label}</span>
                                <span class="text-xs fw-800" style="color:var(--primary)">${score}/10</span>
                            </div>
                            <div class="score-bar-track" style="height:6px; margin-bottom:0.5rem;">
                                <div class="score-bar-fill primary" style="width: ${pct}%"></div>
                            </div>
                            <p class="text-xs text-dim" style="line-height:1.4">${window.IdeaApp.esc(data.reasoning || 'No significant advantage identified.')}</p>
                        </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    async function regenerate() {
        if (!confirm("Regenerate deep risk mapping? This will use fresh AI reasoning.")) return;
        const btn = event.currentTarget;
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;"></div> Analyzing...';

        try {
            await window.IdeaApp.apiFetch(`/ideas/${currentIdeaId}/generate-risks`, { method: 'POST' });
            window.IdeaApp.toast("Risk profile updated", "success");
            init(currentIdeaId, "tabContent-risks");
        } catch (err) {
            window.IdeaApp.toast(err.message, "error");
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    return { init, regenerate };
})();
