/**
 * js/workspace.js
 * Renders the editable workspace for the core idea concept and target audience.
 */

window.Workspace = (() => {
    const app = () => window.IdeaApp;
    let currentIdeaId = null;

    async function init(ideaId, containerId) {
        currentIdeaId = ideaId;
        const container = document.getElementById(containerId);
        container.innerHTML = '<div style="text-align:center;padding:2rem"><div class="spinner" style="margin:0 auto"></div></div>';

        try {
            const idea = await app().api.getIdea(ideaId);
            renderWorkspace(idea, container);
        } catch (err) {
            container.innerHTML = `<div class="card" style="text-align:center;color:var(--kill)">Failed to load workspace: ${app().esc(err.message)}</div>`;
        }
    }

    function renderWorkspace(idea, container) {
        const input = idea.structured_input || {};
        const concept = input.core_concept || { problem: '', solution: '' };
        const audience = input.target_audience || { type: '', location: '', age_group: '' };
        const tierStr = Array.isArray(audience.tier) ? audience.tier.join(', ') : (audience.tier || '');
        const revenue = input.revenue_model || { type: [], expected_price: '' };
        const revStr = Array.isArray(revenue.type) ? revenue.type.join(', ') : (revenue.type || '');

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
                <div>
                    <h2 style="font-size:1.25rem; font-weight:800; margin:0">Strategic Workspace</h2>
                    <p class="text-dim text-sm" style="margin-top:0.25rem">Edit the core parameters of your startup concept.</p>
                </div>
                <button class="btn btn-primary" onclick="window.Workspace.saveWorkspace()">Save Changes</button>
            </div>
            
            <div class="grid grid-2 gap-3 mb-3">
                <div class="card p-4">
                    <h3 class="mb-2" style="font-size:1rem;">Core Concept</h3>
                    <div class="form-group">
                        <label class="text-xs text-dim text-uppercase fw-700">Problem Space</label>
                        <textarea id="ws-problem" class="form-control" rows="3">${app().esc(concept.problem)}</textarea>
                    </div>
                    <div class="form-group mt-2">
                        <label class="text-xs text-dim text-uppercase fw-700">Proposed Solution</label>
                        <textarea id="ws-solution" class="form-control" rows="3">${app().esc(concept.solution)}</textarea>
                    </div>
                </div>

                <div class="card p-4">
                    <h3 class="mb-2" style="font-size:1rem;">Target Market</h3>
                    <div class="form-group">
                        <label class="text-xs text-dim text-uppercase fw-700">Audience Type</label>
                        <input type="text" id="ws-audience-type" class="form-control" value="${app().esc(audience.type)}">
                    </div>
                    <div class="form-group mt-2">
                        <label class="text-xs text-dim text-uppercase fw-700">Geography & Tiers</label>
                        <input type="text" id="ws-audience-location" class="form-control" value="${app().esc(audience.location + (tierStr ? ' | ' + tierStr : ''))}">
                    </div>
                    <div class="form-group mt-2">
                        <label class="text-xs text-dim text-uppercase fw-700">Age Group</label>
                        <input type="text" id="ws-audience-age" class="form-control" value="${app().esc(audience.age_group)}">
                    </div>
                </div>
            </div>

            <div class="card p-4">
                <h3 class="mb-2" style="font-size:1rem;">Business Model Context</h3>
                <div class="grid grid-2 gap-3">
                    <div class="form-group">
                        <label class="text-xs text-dim text-uppercase fw-700">Revenue Stream Types</label>
                        <input type="text" id="ws-revenue-types" class="form-control" value="${app().esc(revStr)}">
                    </div>
                    <div class="form-group">
                        <label class="text-xs text-dim text-uppercase fw-700">Expected Pricing</label>
                        <input type="text" id="ws-revenue-price" class="form-control" value="${app().esc(revenue.expected_price)}">
                    </div>
                </div>
                <div class="grid grid-2 gap-3 mt-3">
                    <div class="form-group">
                        <label class="text-xs text-dim text-uppercase fw-700">Competitor Awareness</label>
                        <textarea id="ws-competitors" class="form-control" rows="2">${app().esc(input.competitor_awareness || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="text-xs text-dim text-uppercase fw-700">Market Trends</label>
                        <textarea id="ws-trends" class="form-control" rows="2">${app().esc(input.market_trends || '')}</textarea>
                    </div>
                </div>
            </div>
        `;
    }

    async function saveWorkspace() {
        const btn = document.querySelector('button[onclick="window.Workspace.saveWorkspace()"]');
        if (btn) btn.textContent = 'Saving...';

        // NOTE: In a full app this would send the updated 'structured_input' back to an API update route.
        // Currently the API only supports creating ideas, deleting, and updating validation arrays.
        // We'll simulate a successful save for demo purposes until the update endpoint is built.

        setTimeout(() => {
            app().toast('Workspace updated successfully (Mock)', 'success');
            if (btn) btn.textContent = 'Save Changes';
        }, 600);
    }

    return { init, saveWorkspace };
})();
