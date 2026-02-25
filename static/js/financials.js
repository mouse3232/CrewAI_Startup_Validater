window.Financials = (() => {
    let currentIdeaId = null;
    let containerId = null;
    let assumptions = {
        initial_investment_inr: 500000,
        monthly_revenue_inr: 100000,
        cogs_percentage: 30,
        fixed_monthly_costs_inr: 40000,
        monthly_growth_rate_pct: 10,
        tax_rate_pct: 25,
        gst_rate_pct: 18
    };

    async function init(ideaId, targetContainer) {
        currentIdeaId = ideaId;
        containerId = targetContainer;

        const container = document.getElementById(containerId);
        container.innerHTML = '<div style="text-align:center;padding:2rem"><div class="spinner" style="margin:0 auto"></div></div>';

        try {
            const idea = await window.IdeaApp.api.getIdea(ideaId);
            renderLayout(idea, container);
            switchFinSubTab('fin-market');
            calculatePlan(); // Load interactive data
        } catch (err) {
            container.innerHTML = `<div class="card" style="text-align:center;color:var(--kill)">Failed to load financials: ${window.IdeaApp.esc(err.message)}</div>`;
        }
    }

    function renderLayout(idea, container) {
        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
                <div>
                    <h2 style="font-size:1.25rem; font-weight:800; margin:0">Financial Intelligence</h2>
                    <p class="text-dim text-sm" style="margin-top:0.25rem">Structured fiscal projections and market sizing models.</p>
                </div>
                <button class="btn btn-outline btn-sm" onclick="window.Financials.regenerate()" style="display:flex; align-items:center; gap:0.4rem;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                    Refresh AI Deep Dive
                </button>
            </div>

            <div class="sub-tabs mb-3" style="display:flex; gap:1.5rem; border-bottom:1px solid var(--border-light); justify-content:flex-start;">
                <button class="fin-sub-tab-btn active" data-subtab="fin-market" onclick="window.Financials.switchFinSubTab('fin-market')">Market Sizing (TAM/SAM/SOM)</button>
                <button class="fin-sub-tab-btn" data-subtab="fin-economics" onclick="window.Financials.switchFinSubTab('fin-economics')">Economics & Cash Flow</button>
                <button class="fin-sub-tab-btn" data-subtab="fin-interactive" onclick="window.Financials.switchFinSubTab('fin-interactive')">Interactive Pro-forma</button>
            </div>

            <!-- Market Sizing Tab -->
            <div id="subtab-fin-market" class="fin-subtab-pane" style="display:none">
                ${renderMarketSizing(idea)}
            </div>

            <!-- Economics Tab -->
            <div id="subtab-fin-economics" class="fin-subtab-pane" style="display:none">
                ${renderEconomics(idea)}
            </div>

            <!-- Interactive Tab -->
            <div id="subtab-fin-interactive" class="fin-subtab-pane" style="display:none">
                <div class="flex" style="gap: 1.5rem; flex-wrap: wrap;">
                    <div class="card" style="flex: 1; min-width: 300px;">
                        <h3 style="margin-top:0; border-bottom:1px solid var(--border-light); padding-bottom:0.5rem;">Interactive Assumptions</h3>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div>
                                <label class="text-sm fw-600 block mb-1">Initial Investment (₹)</label>
                                <input type="number" class="form-control" value="${assumptions.initial_investment_inr}" onchange="window.Financials.updateAssumption('initial_investment_inr', this.value)">
                            </div>
                            <div>
                                <label class="text-sm fw-600 block mb-1">Base Monthly Revenue (₹)</label>
                                <input type="number" class="form-control" value="${assumptions.monthly_revenue_inr}" onchange="window.Financials.updateAssumption('monthly_revenue_inr', this.value)">
                            </div>
                            <div>
                                <label class="text-sm fw-600 block mb-1">Growth %</label>
                                <input type="number" class="form-control" value="${assumptions.monthly_growth_rate_pct}" onchange="window.Financials.updateAssumption('monthly_growth_rate_pct', this.value)">
                            </div>
                            <div>
                                <label class="text-sm fw-600 block mb-1">Fixed Costs (₹)</label>
                                <input type="number" class="form-control" value="${assumptions.fixed_monthly_costs_inr}" onchange="window.Financials.updateAssumption('fixed_monthly_costs_inr', this.value)">
                            </div>
                        </div>
                        <button class="btn btn-primary mt-3 w-100" onclick="window.Financials.calculatePlan()">Recalculate Pro Forma</button>
                    </div>
                    <div class="card" style="flex: 1; min-width: 300px; display:flex; flex-direction:column; justify-content:center;">
                        <div id="fin-summary" style="text-align:center;"></div>
                    </div>
                </div>
                <div class="card mt-3" style="overflow-x: auto;">
                    <h3 style="margin-top:0; border-bottom:1px solid var(--border-light); padding-bottom:0.5rem;">Interactive 12-Month Spreadsheet</h3>
                    <div id="fin-spreadsheet"></div>
                </div>
            </div>
        `;
    }

    function renderMarketSizing(idea) {
        const finData = idea.validations?.[0]?.agent_outputs?.['business_model']?.financial_breakdown?.market_sizing || {};
        const tam = finData.tam || 'Not assessed';
        const sam = finData.sam || 'Not assessed';
        const som = finData.som || 'Not assessed';

        return `
            <div class="grid grid-3 gap-3">
                <div class="card" style="border-top: 4px solid var(--primary)">
                    <h4 class="text-xs fw-800 uppercase mb-2">TAM (Total Addressable Market)</h4>
                    <div class="fw-800 text-lg mb-1">${typeof tam === 'string' ? tam : tam.value}</div>
                    <p class="text-xs text-dim">${typeof tam === 'string' ? '' : window.IdeaApp.esc(tam.reasoning || '')}</p>
                </div>
                <div class="card" style="border-top: 4px solid var(--info)">
                    <h4 class="text-xs fw-800 uppercase mb-2">SAM (Serviceable Market)</h4>
                    <div class="fw-800 text-lg mb-1">${typeof sam === 'string' ? sam : sam.value}</div>
                    <p class="text-xs text-dim">${typeof sam === 'string' ? '' : window.IdeaApp.esc(sam.reasoning || '')}</p>
                </div>
                <div class="card" style="border-top: 4px solid var(--go)">
                    <h4 class="text-xs fw-800 uppercase mb-2">SOM (Serviceable Obtainable)</h4>
                    <div class="fw-800 text-lg mb-1">${typeof som === 'string' ? som : som.value}</div>
                    <p class="text-xs text-dim">${typeof som === 'string' ? '' : window.IdeaApp.esc(som.reasoning || '')}</p>
                </div>
            </div>
            <div class="card mt-3">
                <h3 class="fw-700 mb-2">Pricing Strategy</h3>
                <p class="text-dim">${window.IdeaApp.esc(idea.validations?.[0]?.agent_outputs?.['business_model']?.pricing_strategy || 'Pricing analysis pending.')}</p>
            </div>
        `;
    }

    function renderEconomics(idea) {
        const finData = idea.validations?.[0]?.agent_outputs?.['business_model']?.financial_breakdown || {};
        const costs = finData.cost_breakdown || {};
        const streams = finData.revenue_streams || [];

        return `
            <div class="grid grid-2 gap-3">
                <div class="card">
                    <h3 class="fw-700 mb-2 border-bottom pb-2">Cost Breakdown</h3>
                    <div class="flex flex-col gap-sm">
                        ${Object.entries(costs).map(([key, val]) => `
                            <div class="flex justify-between border-bottom-light pb-1">
                                <span class="capitalize text-sm">${key.replace('_', ' ')}</span>
                                <span class="fw-700 text-sm">${val}</span>
                            </div>
                        `).join('') || '<p class="text-dim italic">No cost data available</p>'}
                    </div>
                </div>
                <div class="card">
                    <h3 class="fw-700 mb-2 border-bottom pb-2">Revenue Streams</h3>
                    <div class="flex flex-col gap-sm">
                        ${streams.map(s => `
                            <div class="flex justify-between border-bottom-light pb-1">
                                <span class="text-sm">${s.name}</span>
                                <span class="badge badge-info">${s.estimated_contribution_pct}%</span>
                            </div>
                        `).join('') || '<p class="text-dim italic">No revenue streams analyzed yet</p>'}
                    </div>
                </div>
            </div>
            <div class="card mt-3" style="border-left: 5px solid var(--go)">
                <h3 class="fw-700 mb-1">Cash Flow Projection (AI Estimated)</h3>
                <div class="grid grid-3 gap-2 mt-2">
                    <div><span class="text-xs text-dim uppercase">Monthly Inflow</span><div class="fw-700">${finData.cash_flow_projection?.monthly_inflow || '—'}</div></div>
                    <div><span class="text-xs text-dim uppercase">Monthly Burn</span><div class="fw-700 text-kill">${finData.cash_flow_projection?.monthly_burn || '—'}</div></div>
                    <div><span class="text-xs text-dim uppercase">Break-even</span><div class="fw-700 text-go">${finData.cash_flow_projection?.break_even_estimate || '—'}</div></div>
                </div>
            </div>
        `;
    }

    function switchFinSubTab(subtabId) {
        document.querySelectorAll('.fin-sub-tab-btn').forEach(btn => {
            const isActive = btn.dataset.subtab === subtabId;
            btn.classList.toggle('active', isActive);
            if (isActive) {
                btn.style.color = 'var(--primary)';
                btn.style.borderBottomColor = 'var(--primary)';
            } else {
                btn.style.color = 'var(--text-dim)';
                btn.style.borderBottomColor = 'transparent';
            }
        });

        document.querySelectorAll('.fin-subtab-pane').forEach(pane => {
            pane.style.display = (pane.id === `subtab-${subtabId}`) ? 'block' : 'none';
        });
    }

    function updateAssumption(key, val) {
        assumptions[key] = parseFloat(val) || 0;
    }

    async function calculatePlan() {
        const c = document.getElementById('fin-spreadsheet');
        const sum = document.getElementById('fin-summary');
        if (c) c.innerHTML = '<div class="spinner" style="margin:2rem auto;"></div>';

        try {
            const result = await window.IdeaApp.api.getFinancialPlan(currentIdeaId, assumptions);
            renderSpreadsheet(result);
            renderSummary(result);
        } catch (e) {
            if (c) c.innerHTML = `<div class="text-kill padding-2">Failed to load interactive model: ${window.IdeaApp.esc(e.message)}</div>`;
        }
    }

    function renderSummary(data) {
        const sum = document.getElementById('fin-summary');
        if (!sum) return;
        const formatINR = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
        const cashM12 = data.cumulative_cashflow[11];
        sum.innerHTML = `
            <h2 style="margin:0; font-size: 2rem; color: ${cashM12 >= 0 ? 'var(--go)' : 'var(--kill)'}">${formatINR(cashM12)}</h2>
            <div class="text-dim text-xs uppercase fw-700 mb-2">Year 1 Cumulative Cash</div>
            <div class="flex gap-sm mt-1">
                <span class="badge badge-info">ROI: ${data.roi_percentage}%</span>
                <span class="badge badge-draft">BE: ${data.breakeven_month ? 'M' + data.breakeven_month : '—'}</span>
            </div>
        `;
    }

    function renderSpreadsheet(data) {
        const table = document.getElementById('fin-spreadsheet');
        if (!table) return;
        const formatINR = (val) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
        let html = `<table style="width:100%; border-collapse: collapse; min-width: 800px; text-align:right; font-variant-numeric: tabular-nums;">
                <thead><tr style="border-bottom: 2px solid var(--border-light);"><th style="text-align:left; padding: 0.5rem; color: var(--text-dim);">Metric (₹)</th>
                ${data.months.map(m => `<th style="padding: 0.5rem; color: var(--text-dim);">${m}</th>`).join('')}</tr></thead><tbody>`;

        const addRow = (label, values, isBold = false, color = '') => {
            html += `<tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
                <td style="text-align:left; padding: 0.5rem; font-weight: ${isBold ? '700' : '400'}; color: ${color || 'var(--text)'}">${label}</td>
                ${values.map(v => `<td style="padding: 0.5rem; font-weight: ${isBold ? '700' : '400'}; color: ${color || 'var(--text)'}">${formatINR(v)}</td>`).join('')}</tr>`;
        };
        addRow('Revenue', data.revenues, true);
        addRow('Gross Profit', data.gross_profits, false, 'var(--primary)');
        addRow('Net Profit', data.net_profits, true, 'var(--go)');
        addRow('Cum. Cash', data.cumulative_cashflow, true, 'var(--info)');
        html += '</tbody></table>';
        table.innerHTML = html;
    }

    async function regenerate() {
        if (!confirm("Regenerate market sizing and pricing analysis? This will use fresh AI reasoning.")) return;
        const btn = event.currentTarget;
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;"></div> Analyzing...';

        try {
            await window.IdeaApp.apiFetch(`/ideas/${currentIdeaId}/generate-financials`, { method: 'POST' });
            window.IdeaApp.toast("Financial intelligence updated", "success");
            init(currentIdeaId, containerId);
        } catch (err) {
            window.IdeaApp.toast(err.message, "error");
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    return { init, updateAssumption, calculatePlan, switchFinSubTab, regenerate };
})();
