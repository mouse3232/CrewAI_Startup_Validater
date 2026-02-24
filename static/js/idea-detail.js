/**
 * IdeaDetail.js — Full validation report, charts, business canvas, agent sections & Contextual Q&A
 */

window.IdeaDetail = (() => {
    const app = () => window.IdeaApp;
    const $content = () => document.getElementById('appContent');
    let charts = {};
    let currentIdeaId = null;

    async function render(ideaId) {
        currentIdeaId = ideaId;
        const el = $content();
        el.innerHTML = '<div style="text-align:center;padding:4rem"><div class="spinner" style="margin:0 auto"></div><p class="text-dim mt-2">Loading idea…</p></div>';

        let idea;
        try {
            idea = await app().api.getIdea(ideaId);
        } catch (err) {
            el.innerHTML = `<div class="card" style="text-align:center; padding: 4rem;"><h2>Idea not found</h2><p class="text-dim">${err.message}</p><a href="#/" class="btn btn-outline mt-2">Back to Dashboard</a></div>`;
            return;
        }

        const v = idea.validations && idea.validations[0];
        const analytics = idea.scoring_analytics || null;
        el.innerHTML = buildPage(idea, v, analytics);

        if (v) {
            renderCharts(v);
        }
    }

    function buildPage(idea, v, analytics) {
        const hasVal = !!v;
        return `
            <div class="detail-header">
                <a href="#/" class="detail-back" title="Back to Dashboard">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                </a>
                <div style="flex-grow:1">
                    <div class="flex" style="align-items:center; gap: 1rem">
                        <h1 class="detail-title" style="margin:0">${esc(idea.title)}</h1>
                        ${app().decisionBadge(idea.latest_decision)}
                    </div>
                </div>
                <div class="flex gap-sm">
                    <button class="btn btn-outline btn-sm" onclick="window.IdeaApp.toggleActivityDrawer()" title="View Real-time Agent Activity">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        Activity Console
                    </button>
                    ${hasVal ? `
                        <button class="btn btn-outline btn-sm" onclick="window.IdeaDetail.startValidation(${idea.id})">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                            Re-validate
                        </button>
                    ` : `
                        <button class="btn btn-primary btn-sm" onclick="window.IdeaDetail.startValidation(${idea.id})">
                            Validate Now
                        </button>
                    `}
                    <button class="btn btn-danger btn-sm" onclick="window.IdeaDetail.deleteIdea(${idea.id})" title="Delete Idea">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>

            <p class="text-dim mb-3" style="max-width:800px; font-size: 1.05rem;">${esc(idea.description)}</p>

            <!-- Dynamic Progress Tracker -->
            <div id="progressStepperContainer" style="display:none">
                <div class="progress-stepper" id="progressStepper">
                    <div class="step-item" id="step-structuring"><div class="step-circle">1</div><div class="step-label">Structuring</div></div>
                    <div class="step-item" id="step-analysis"><div class="step-circle">2</div><div class="step-label">Agent Analysis</div></div>
                    <div class="step-item" id="step-scoring"><div class="step-circle">3</div><div class="step-label">Scoring</div></div>
                    <div class="step-item" id="step-refinement"><div class="step-circle">4</div><div class="step-label">Refinement</div></div>
                    <div class="step-item" id="step-exec"><div class="step-circle">5</div><div class="step-label">Exec Summary</div></div>
                </div>
            </div>
            <div class="view-tabs" style="display:flex; gap:1rem; border-bottom:1px solid var(--border-light); margin-bottom:1.5rem; justify-content:flex-start; overflow-x:auto">
                <button class="view-btn active" data-tab="validation" onclick="window.IdeaDetail.switchTab('validation')" style="padding:0.75rem 1rem; border:none; background:transparent; font-weight:700; color:var(--primary); border-bottom:2px solid var(--primary); cursor:pointer">Validation Report</button>
                <button class="view-btn" data-tab="tasks" onclick="window.IdeaDetail.switchTab('tasks')" style="padding:0.75rem 1rem; border:none; background:transparent; font-weight:600; color:var(--text-dim); border-bottom:2px solid transparent; cursor:pointer">Tasks & Execution</button>
                <button class="view-btn" data-tab="journal" onclick="window.IdeaDetail.switchTab('journal')" style="padding:0.75rem 1rem; border:none; background:transparent; font-weight:600; color:var(--text-dim); border-bottom:2px solid transparent; cursor:pointer">Execution Journal</button>
                <button class="view-btn" data-tab="experiments" onclick="window.IdeaDetail.switchTab('experiments')" style="padding:0.75rem 1rem; border:none; background:transparent; font-weight:600; color:var(--text-dim); border-bottom:2px solid transparent; cursor:pointer">Real-World Tests</button>
            </div>

            <div id="tabContent-validation" class="tab-pane active" style="display:block">
                <div id="validationResultsArea">
                    ${hasVal ? renderValidationResults(v, analytics) : renderValidationPrompt()}
                </div>
            </div>
            <div id="tabContent-tasks" class="tab-pane" style="display:none"></div>
            <div id="tabContent-journal" class="tab-pane" style="display:none"></div>
            <div id="tabContent-experiments" class="tab-pane" style="display:none"></div>
        `;
    }

    function renderValidationPrompt() {
        return `
            <div class="card mt-3" style="text-align:center; padding: 4rem 2rem;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary-light)" stroke-width="2" style="margin-bottom:1rem">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                <h2 class="mb-1">Ready for Validation</h2>
                <p class="text-dim text-sm mb-2" style="max-width:400px; margin: 0 auto 1.5rem auto;">
                    Click Validate Now to unleash 7 specialized AI agents to analyze market size, technical feasibility, business models, and behavioral psychology.
                </p>
            </div>
        `;
    }

    function renderValidationResults(v, analytics) {
        return `
            <!-- Executive Summary -->
            <div class="card mt-2 mb-3">
                ${renderExecutiveSummary(v.executive_summary)}
            </div>

            <!-- Score overview -->
            <div class="detail-scores">
                <div class="card score-card">
                    <div class="score-card-value" style="color:var(--${app().decisionClass(v.decision)})">${(v.final_score || 0).toFixed(1)}<span style="font-size:1rem;color:var(--text-muted)">/10</span></div>
                    <div class="score-card-label">Final Score</div>
                </div>
                <div class="card score-card">
                    <div class="score-card-value">${v.decision || '—'}</div>
                    <div class="score-card-label">Decision</div>
                </div>
                <div class="card score-card">
                    <div class="score-card-value" style="color:var(--info)">${(v.confidence_index || 0).toFixed(0)}%</div>
                    <div class="score-card-label">AI Confidence</div>
                </div>
                <div class="card score-card">
                    <div class="score-card-value" style="color:var(--primary)">#${v.iteration || 1}</div>
                    <div class="score-card-label">Refinement Iteration</div>
                </div>
            </div>

            ${app().scoreBarHTML(v.final_score, v.decision)}

            <!-- Scenario Simulation -->
            ${analytics && analytics.scenario_scores ? renderScenarioCards(analytics.scenario_scores) : ''}

            <!-- Weighted Breakdown -->
            ${analytics && analytics.weighted_breakdown ? renderWeightedBreakdown(analytics.weighted_breakdown) : ''}

            <!-- Sensitivity Analysis -->
            ${analytics && analytics.sensitivity ? renderSensitivity(analytics.sensitivity) : ''}

            <!-- Charts -->
            <div class="detail-grid mt-3">
                <div class="card chart-card">
                    <h3>Dimension Scores</h3>
                    <div class="chart-wrapper"><canvas id="radarChart"></canvas></div>
                </div>
                <div class="card chart-card">
                    <h3>Weighted Contribution</h3>
                    <div class="chart-wrapper"><canvas id="barChart"></canvas></div>
                </div>
                <div class="card chart-card">
                    <h3>Confidence Gauge</h3>
                    <div class="chart-wrapper"><canvas id="gaugeChart"></canvas></div>
                </div>
                <div class="card chart-card">
                    <h3>Score Evolution</h3>
                    <div class="chart-wrapper"><canvas id="evolutionChart"></canvas></div>
                </div>
            </div>

            <!-- Business Model Canvas -->
            <div class="flex mt-3 mb-2" style="justify-content:space-between; align-items:flex-end">
                <h3 class="fw-700 m-0" style="font-size:1.25rem">Business Validation Canvas</h3>
                <div class="flex gap-sm">
                    <span class="text-sm text-dim">Interactive Strategy Workboard</span>
                    <button class="btn btn-outline btn-sm" onclick="window.IdeaDetail.exportPDF()" style="font-size:0.75rem">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export PDF
                    </button>
                </div>
            </div>
            ${renderCanvas(v.structured_idea)}

            <!-- Agent Sections -->
            <h3 class="fw-700 mt-3 mb-2" style="font-size:1.25rem">Agent Deep Dives</h3>
            <div class="agent-sections" id="agentSections">
                ${renderAgentSections(v.agent_outputs)}
            </div>

            <!-- Refinement Timeline -->
            ${v.refinement_history && v.refinement_history.length ? renderTimeline(v.refinement_history) : ''}
        `;
    }

    function renderExecutiveSummary(exec) {
        if (!exec || typeof exec !== 'object') return '';
        const summary = exec.executive_summary || '';
        const strengths = exec.strengths || [];
        const weaknesses = exec.weaknesses || [];
        const recommendations = exec.recommendations || [];

        return `
            <div class="exec-summary">
                <h3 class="flex gap-sm" style="align-items:center;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Executive Summary
                </h3>
                <p class="mt-1 text-dim" style="font-size:1.05rem">${esc(summary)}</p>
                <div class="mt-2" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                    ${strengths.length ? `<div><h4 class="text-sm fw-700" style="color:var(--go); border-bottom: 1px solid var(--border-light); padding-bottom: 0.25rem">Key Strengths</h4><ul class="exec-list">${strengths.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
                    ${weaknesses.length ? `<div><h4 class="text-sm fw-700" style="color:var(--kill); border-bottom: 1px solid var(--border-light); padding-bottom: 0.25rem">Critical Risks</h4><ul class="exec-list">${weaknesses.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
                    ${recommendations.length ? `<div><h4 class="text-sm fw-700" style="color:var(--info); border-bottom: 1px solid var(--border-light); padding-bottom: 0.25rem">Strategic Recommendations</h4><ul class="exec-list">${recommendations.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
                </div>
            </div>
        `;
    }

    // ── Scenario Simulation Cards ─────────────────────────────
    function renderScenarioCards(scenarios) {
        const sc = (label, data, color, icon) => `
            <div class="card" style="text-align:center;padding:1.25rem;border-top:3px solid ${color}">
                <div style="font-size:1.5rem;margin-bottom:0.25rem">${icon}</div>
                <div class="text-xs text-dim" style="text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem">${label}</div>
                <div style="font-size:1.75rem;font-weight:800;color:${color}">${data.score.toFixed(1)}</div>
                <span class="decision-badge decision-${data.decision.toLowerCase()}" style="margin-top:0.5rem;display:inline-block">${data.decision}</span>
            </div>`;
        return `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:1.5rem 0">
                ${sc('Best Case', scenarios.best_case, 'var(--go)', '🚀')}
                ${sc('Realistic', scenarios.realistic, 'var(--improve)', '📊')}
                ${sc('Worst Case', scenarios.worst_case, 'var(--kill)', '⚠️')}
            </div>`;
    }

    // ── Weighted Breakdown Table ─────────────────────────────
    function renderWeightedBreakdown(breakdown) {
        const rows = breakdown.map(b => `
            <tr style="border-bottom:1px solid var(--border-light)">
                <td style="padding:0.6rem 0.5rem;font-weight:600">${esc(b.label)}</td>
                <td style="padding:0.6rem;text-align:center">${b.weight_pct}%</td>
                <td style="padding:0.6rem;text-align:center">${b.raw_score.toFixed(1)}</td>
                <td style="padding:0.6rem;text-align:center">${b.adjusted_score.toFixed(1)}</td>
                <td style="padding:0.6rem;text-align:center;font-weight:700;color:var(--primary)">${b.contribution.toFixed(2)}</td>
            </tr>`).join('');

        return `
        <div class="card mt-2">
            <h3 style="font-size:1rem;font-weight:700;margin-bottom:1rem">Weighted Score Breakdown</h3>
            <table style="width:100%;font-size:0.85rem;border-collapse:collapse">
                <thead><tr style="color:var(--text-dim);border-bottom:2px solid var(--border)">
                    <th style="padding:0.5rem;text-align:left">Dimension</th>
                    <th style="padding:0.5rem;text-align:center">Weight</th>
                    <th style="padding:0.5rem;text-align:center">Raw</th>
                    <th style="padding:0.5rem;text-align:center">Adjusted</th>
                    <th style="padding:0.5rem;text-align:center">Contribution</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
    }

    // ── Sensitivity Analysis ────────────────────────────────
    function renderSensitivity(sensitivity) {
        const bars = sensitivity.map(s => `
            <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
                <div style="width:140px;font-size:0.82rem;font-weight:600;flex-shrink:0">${esc(s.label)}</div>
                <div style="flex:1;height:10px;background:#f1f5f9;border-radius:5px;overflow:hidden">
                    <div style="height:100%;width:${Math.min(s.impact_pct * 3, 100)}%;background:${s.impact_pct > 10 ? '#ef4444' : s.impact_pct > 5 ? '#f59e0b' : '#10b981'};border-radius:5px;transition:width 0.4s"></div>
                </div>
                <span style="font-size:0.8rem;font-weight:700;color:var(--kill);min-width:55px;text-align:right">-${s.impact_if_drops_2} pts</span>
            </div>`).join('');

        return `
        <div class="card mt-2">
            <h3 style="font-size:1rem;font-weight:700;margin-bottom:0.5rem">Sensitivity Analysis</h3>
            <p class="text-dim text-xs" style="margin-bottom:1rem">Impact on final score if each dimension drops by 2 points</p>
            ${bars}
        </div>`;
    }

    function renderCanvas(structured) {
        if (!structured) return '<div class="card text-dim text-sm">No canvas data available.</div>';
        const c = structured.business_model_canvas || {};
        const intel = structured.canvas_intelligence || {};
        const deps = structured.cross_block_dependencies || [];

        const cell = (cls, id, title, data) => {
            const items = Array.isArray(data) ? data : (typeof data === 'string' ? [data] : []);
            const blockIntel = intel[id] || {};
            const strength = blockIntel.strength || '';
            const riskExp = blockIntel.risk_exposure;
            const commentary = blockIntel.strategic_commentary || '';

            const strengthBadge = strength === 'strong' ? '<span style="color:var(--go);font-size:0.7rem;font-weight:700">● STRONG</span>'
                : strength === 'weak' ? '<span style="color:var(--kill);font-size:0.7rem;font-weight:700">● WEAK</span>'
                    : strength === 'moderate' ? '<span style="color:var(--improve);font-size:0.7rem;font-weight:700">● MODERATE</span>' : '';

            const riskBadge = typeof riskExp === 'number' ? `<span style="font-size:0.7rem;color:${riskExp > 6 ? 'var(--kill)' : riskExp > 3 ? 'var(--improve)' : 'var(--go)'};font-weight:600">Risk: ${riskExp}/10</span>` : '';

            return `
                <div class="canvas-cell ${cls}" data-risk="${riskExp || 0}" data-strength="${strength}">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem">
                        <h4 style="margin:0">${title}</h4>
                        <div class="canvas-badges" style="display:flex;gap:0.5rem;align-items:center;transition:opacity 0.3s">${strengthBadge} ${riskBadge}</div>
                    </div>
                    <ul>${items.map(i => `<li>${esc(String(i))}</li>`).join('') || '<li class="text-muted">—</li>'}</ul>
                    ${commentary ? `<div class="canvas-commentary" style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px dashed var(--border-light);font-size:0.75rem;color:var(--text-dim);font-style:italic">💡 ${esc(commentary)}</div>` : ''}
                    <button class="canvas-qa-btn" onclick="window.IdeaDetail.openQA('${id}', '${title}')" title="Ask a question or request a refinement">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </button>
                    ${renderQAPanel(id)}
                </div>
            `;
        };

        const depsList = deps.length ? `
            <div class="card mt-2" style="padding:1rem">
                <h4 style="font-size:0.9rem;font-weight:700;margin-bottom:0.75rem">Cross-Block Dependencies</h4>
                <div style="display:flex;flex-wrap:wrap;gap:0.5rem">
                    ${deps.map(d => `<span style="font-size:0.75rem;padding:0.3rem 0.75rem;border-radius:999px;background:var(--bg-alt);border:1px solid var(--border-light)">${esc(d.from_block)} → ${esc(d.to_block)} <span class="text-dim">(${d.impact_strength}/10)</span></span>`).join('')}
                </div>
            </div>` : '';

        // Extract metrics if available
        const metrics = structured.metrics || { tam: 'TBD', sam: 'TBD', som: 'TBD', margins: 'TBD' };

        return `
            <div class="canvas-toolbar" style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-alt); padding:0.75rem 1rem; border-radius:var(--radius); margin-bottom:1rem; border:1px solid var(--border-light)">
                <div style="display:flex; gap:1.5rem; font-size:0.8rem">
                    <div><span class="text-dim fw-600">TAM:</span> <span class="fw-800">${esc(metrics.tam)}</span></div>
                    <div><span class="text-dim fw-600">SAM:</span> <span class="fw-800">${esc(metrics.sam)}</span></div>
                    <div><span class="text-dim fw-600">SOM:</span> <span class="fw-800">${esc(metrics.som)}</span></div>
                    <div><span class="text-dim fw-600">Est. Margins:</span> <span class="fw-800">${esc(metrics.margins)}</span></div>
                </div>
                <div style="display:flex; align-items:center; gap:0.5rem">
                    <span class="text-xs fw-700 text-dim">RISK HEATMAP</span>
                    <label class="toggle-switch">
                        <input type="checkbox" onchange="window.IdeaDetail.toggleRiskHeatmap(this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>

            <div class="canvas-grid" id="mainCanvasGrid">
                ${cell('canvas-partners', 'key_partners', 'Key Partners', c.key_partners)}
                ${cell('canvas-activities', 'key_activities', 'Key Activities', c.key_activities)}
                ${cell('canvas-resources', 'key_resources', 'Key Resources', c.key_resources)}
                ${cell('canvas-value', 'value_propositions', 'Value Propositions', c.value_propositions)}
                ${cell('canvas-relations', 'customer_relationships', 'Customer Relationships', c.customer_relationships)}
                ${cell('canvas-channels', 'channels', 'Channels', c.channels)}
                ${cell('canvas-segments', 'customer_segments', 'Customer Segments', c.customer_segments)}
                ${cell('canvas-cost', 'cost_structure', 'Cost Structure', c.cost_structure)}
                ${cell('canvas-revenue', 'revenue_streams', 'Revenue Streams', c.revenue_streams)}
            </div>
            ${depsList}
        `;
    }

    function renderQAPanel(id) {
        return `
            <div class="qa-panel" id="qa-${id}">
                <div class="qa-quick-actions" style="display:flex;flex-wrap:wrap;gap:0.35rem;margin-bottom:0.5rem;padding-bottom:0.5rem;border-bottom:1px solid var(--border-light)">
                    <button class="qa-quick-btn" onclick="window.IdeaDetail.submitQuickAction('${id}','Why was this chosen?')" style="font-size:0.7rem;padding:0.25rem 0.5rem;border-radius:999px;border:1px solid var(--border);background:var(--bg-alt);cursor:pointer;color:var(--text-dim);transition:all 0.2s" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">💡 Why this?</button>
                    <button class="qa-quick-btn" onclick="window.IdeaDetail.webValidate('${id}')" style="font-size:0.7rem;padding:0.25rem 0.5rem;border-radius:999px;border:1px solid var(--border);background:var(--bg-alt);cursor:pointer;color:var(--text-dim);transition:all 0.2s" onmouseover="this.style.borderColor='var(--info)'" onmouseout="this.style.borderColor='var(--border)'">🌐 Validate with Market Data</button>
                    <button class="qa-quick-btn" onclick="window.IdeaDetail.submitQuickAction('${id}','Review this section and suggest improvements')" style="font-size:0.7rem;padding:0.25rem 0.5rem;border-radius:999px;border:1px solid var(--border);background:var(--bg-alt);cursor:pointer;color:var(--text-dim);transition:all 0.2s" onmouseover="this.style.borderColor='var(--improve)'" onmouseout="this.style.borderColor='var(--border)'">📋 Request Review</button>
                </div>
                <div class="qa-chat-history" id="qa-hist-${id}"></div>
                <div class="qa-input-grp">
                    <input type="text" id="qa-in-${id}" placeholder="Ask a question or suggest refinement..." onkeypress="if(event.key==='Enter') window.IdeaDetail.submitQA('${id}')">
                    <button class="btn btn-primary btn-sm" onclick="window.IdeaDetail.submitQA('${id}')">Send</button>
                </div>
            </div>
        `;
    }

    const AGENT_LABELS = {
        market_research: { label: 'Market Research', icon: '📊' },
        problem_solution_fit: { label: 'Problem-Solution Fit', icon: '🎯' },
        technical_feasibility: { label: 'Technical Feasibility', icon: '⚙️' },
        business_model: { label: 'Business Model', icon: '💰' },
        user_psychology: { label: 'User Psychology', icon: '🧠' },
        risk_inversion: { label: 'Risk Assessment', icon: '⚠️' },
        customer_persona: { label: 'Customer Persona', icon: '👤' },
        pricing_strategy: { label: 'Pricing Strategy', icon: '💲' },
        gtm_planner: { label: 'GTM Strategy', icon: '📈' },
    };

    function renderAgentSections(outputs) {
        if (!outputs) return '';
        return Object.entries(outputs).map(([key, data]) => {
            const info = AGENT_LABELS[key] || { label: key.replace(/_/g, ' '), icon: '🤖' };
            if (data.error) {
                return `<div class="agent-section"><div class="agent-section-header"><div class="agent-section-title">${info.icon} ${info.label}</div><span class="badge badge-kill">Error</span></div></div>`;
            }
            const kvPairs = Object.entries(data).map(([k, v]) => {
                const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                let val = v;
                if (Array.isArray(v)) {
                    val = v.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(', ');
                } else if (typeof v === 'object' && v !== null) {
                    val = JSON.stringify(v);
                }
                return `<dt>${esc(label)}</dt><dd>${esc(String(val))}</dd>`;
            }).join('');

            return `
                <div class="agent-section" id="agent-${key}">
                    <div class="agent-section-header" onclick="this.parentElement.classList.toggle('open')">
                        <div class="agent-section-title">${info.icon} ${info.label}</div>
                        <div class="flex gap-sm" style="align-items:center">
                            <span class="agent-status-indicator" id="status-${key}"></span>
                            <svg class="agent-section-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                    </div>
                    <div class="agent-section-body">
                        <div class="agent-section-content">
                            <dl class="agent-kv">${kvPairs}</dl>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderTimeline(history) {
        return `
            <div class="card mt-3">
                <h3 class="fw-700 mb-2" style="font-size:1.1rem">Refinement History</h3>
                <div style="display:flex; flex-direction:column; gap:0.5rem">
                    ${history.map(h => `
                        <div style="font-size:0.9rem; padding: 0.75rem; background: var(--bg-main); border-radius: var(--radius-sm); border-left: 3px solid var(--improve)">
                            <strong>Iteration ${h.iteration}</strong> — Rewrote Orchestrator prompt focusing on <em>${(h.weakest_dimension || '').replace(/_/g, ' ')}</em>
                            <br>
                            <span style="color: ${h.delta >= 0 ? 'var(--go)' : 'var(--kill)'}; font-weight: 700">
                                ${h.delta >= 0 ? '+' : ''}${h.delta.toFixed(2)}
                            </span>
                            <span class="text-dim">(${h.prev_score.toFixed(2)} → ${h.new_score.toFixed(2)})</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // ── Charts (Updated for Light Theme) ────────────────────
    function renderCharts(v) {
        destroyCharts();
        const sh = v.score_history || [];
        const latest = sh[sh.length - 1] || {};
        const dims = latest.dimensions || {};

        const labels = Object.keys(dims).map(k => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
        const values = Object.values(dims);

        // Radar
        const radarCtx = document.getElementById('radarChart');
        if (radarCtx) {
            charts.radar = new Chart(radarCtx, {
                type: 'radar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Score', data: values,
                        backgroundColor: 'rgba(15, 23, 42, 0.05)', borderColor: '#0f172a',
                        borderWidth: 2, pointBackgroundColor: '#0f172a', pointRadius: 4,
                    }],
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        r: {
                            min: 0, max: 10,
                            ticks: { stepSize: 2, color: '#64748b', backdropColor: 'transparent' },
                            grid: { color: 'rgba(15, 23, 42, 0.1)' },
                            pointLabels: { color: '#0f172a', font: { size: 11, weight: '600' } },
                        },
                    },
                    plugins: { legend: { display: false } },
                },
            });
        }

        // Bar — weighted
        const weights = [0.25, 0.20, 0.20, 0.15, 0.10, 0.10];
        const weighted = values.map((v, i) => +(v * (weights[i] || 0.1)).toFixed(2));
        const barCtx = document.getElementById('barChart');
        if (barCtx) {
            charts.bar = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        { label: 'Raw Score', data: values, backgroundColor: 'rgba(15, 23, 42, 0.1)', borderColor: '#0f172a', borderWidth: 1, borderRadius: 4 },
                        { label: 'Weighted', data: weighted, backgroundColor: '#3b82f6', borderColor: '#2563eb', borderWidth: 1, borderRadius: 4 },
                    ],
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { display: false } },
                        y: { min: 0, max: 10, ticks: { color: '#64748b' }, grid: { color: 'rgba(15, 23, 42, 0.05)' } },
                    },
                    plugins: { legend: { labels: { color: '#0f172a', font: { size: 11 } } } },
                },
            });
        }

        // Gauge
        const gaugeCtx = document.getElementById('gaugeChart');
        if (gaugeCtx) {
            const conf = v.confidence_index || 0;
            charts.gauge = new Chart(gaugeCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Confidence', ''],
                    datasets: [{
                        data: [conf, 100 - conf],
                        backgroundColor: ['#3b82f6', 'rgba(15, 23, 42, 0.05)'],
                        borderWidth: 0, circumference: 180, rotation: 270,
                    }],
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: '75%',
                    plugins: { legend: { display: false }, tooltip: { enabled: false } },
                },
                plugins: [{
                    id: 'gaugeText',
                    afterDraw(chart) {
                        const { ctx, width, height } = chart;
                        ctx.save(); ctx.fillStyle = '#0f172a'; ctx.font = 'bold 28px Inter, sans-serif';
                        ctx.textAlign = 'center'; ctx.fillText(`${conf.toFixed(0)}%`, width / 2, height / 2 + 10);
                        ctx.font = '12px Inter, sans-serif'; ctx.fillStyle = '#64748b';
                        ctx.fillText('Confidence Match', width / 2, height / 2 + 32); ctx.restore();
                    },
                }],
            });
        }

        // Evolution
        const evoCtx = document.getElementById('evolutionChart');
        if (evoCtx && sh.length > 0) {
            charts.evolution = new Chart(evoCtx, {
                type: 'line',
                data: {
                    labels: sh.map(s => `Iter ${s.iteration}`),
                    datasets: [{
                        label: 'Score', data: sh.map(s => s.score),
                        borderColor: '#0f172a', backgroundColor: 'rgba(15, 23, 42, 0.05)',
                        fill: true, tension: 0.4,
                        pointBackgroundColor: sh.map(s => s.decision === 'GO' ? '#10b981' : s.decision === 'IMPROVE' ? '#f59e0b' : '#ef4444'),
                        pointRadius: 6, pointBorderWidth: 2, pointBorderColor: '#fff',
                    }],
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        x: { ticks: { color: '#64748b' }, grid: { display: false } },
                        y: { min: 0, max: 10, ticks: { color: '#64748b' }, grid: { color: 'rgba(15, 23, 42, 0.05)' } },
                    },
                    plugins: { legend: { display: false } },
                },
            });
        }
    }

    function destroyCharts() {
        Object.values(charts).forEach(c => c && c.destroy());
        charts = {};
    }

    // ── Contextual Q&A ──────────────────────────────────────
    function openQA(sectionId, title) {
        document.querySelectorAll('.qa-panel').forEach(p => p.classList.remove('open'));
        const panel = document.getElementById(`qa-${sectionId}`);
        if (panel) panel.classList.add('open');
        const input = document.getElementById(`qa-in-${sectionId}`);
        if (input) input.focus();
    }

    async function submitQA(sectionId) {
        const input = document.getElementById(`qa-in-${sectionId}`);
        const text = input.value.trim();
        if (!text) return;

        const hist = document.getElementById(`qa-hist-${sectionId}`);

        // Add User Message
        const uMsg = document.createElement('div');
        uMsg.className = 'qa-msg user';
        uMsg.textContent = text;
        hist.appendChild(uMsg);
        input.value = '';
        hist.scrollTop = hist.scrollHeight;

        // Determine intent: Q&A or Refinement?
        const isRefinement = /^(update|refine|change|rewrite|modify|add|remove)/i.test(text);

        // Add loading state
        const loadMsg = document.createElement('div');
        loadMsg.className = 'qa-msg ai';
        loadMsg.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px"></div>';
        hist.appendChild(loadMsg);

        try {
            if (isRefinement) {
                const res = await app().apiFetch(`/ideas/${currentIdeaId}/refine-section`, {
                    method: 'POST',
                    body: JSON.stringify({ section: sectionId, feedback: text })
                });

                loadMsg.innerHTML = '<span style="color:var(--go); font-weight:700">✓ Section updated successfully!</span>';
                setTimeout(() => render(currentIdeaId), 1500);
                app().toast('Section refined inline.', 'success');

            } else {
                const res = await app().apiFetch(`/ideas/${currentIdeaId}/qa`, {
                    method: 'POST',
                    body: JSON.stringify({ section: sectionId, question: text })
                });
                loadMsg.innerHTML = renderQAResponse(res);
            }
        } catch (err) {
            loadMsg.textContent = `Error: ${err.message}`;
            loadMsg.style.color = 'var(--kill)';
        }
        hist.scrollTop = hist.scrollHeight;
    }

    function submitQuickAction(sectionId, question) {
        const input = document.getElementById(`qa-in-${sectionId}`);
        if (input) {
            input.value = question;
            openQA(sectionId, '');
            submitQA(sectionId);
        }
    }

    async function webValidate(sectionId) {
        openQA(sectionId, '');
        const hist = document.getElementById(`qa-hist-${sectionId}`);

        const uMsg = document.createElement('div');
        uMsg.className = 'qa-msg user';
        uMsg.textContent = '🌐 Validate with Market Data';
        hist.appendChild(uMsg);

        const loadMsg = document.createElement('div');
        loadMsg.className = 'qa-msg ai';
        loadMsg.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> <span class="text-dim text-xs">Searching web sources via groq/compound…</span>';
        hist.appendChild(loadMsg);

        try {
            const res = await app().apiFetch(`/ideas/${currentIdeaId}/web-validate`, {
                method: 'POST',
                body: JSON.stringify({ section: sectionId })
            });
            loadMsg.innerHTML = renderQAResponse(res);
        } catch (err) {
            loadMsg.textContent = `Error: ${err.message}`;
            loadMsg.style.color = 'var(--kill)';
        }
        hist.scrollTop = hist.scrollHeight;
    }

    function renderQAResponse(res) {
        const answer = esc(res.answer || '');
        const tier = res.validation_tier || 'standard';
        const model = res.model_used || '';
        const confidence = res.validation_confidence || 0;
        const sources = res.sources || [];

        const tierBadge = tier === 'web_deep' ? '<span style="display:inline-block;font-size:0.65rem;padding:0.15rem 0.5rem;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-weight:600">🌐 Web Deep</span>'
            : tier === 'web_quick' ? '<span style="display:inline-block;font-size:0.65rem;padding:0.15rem 0.5rem;border-radius:999px;background:#fef3c7;color:#92400e;font-weight:600">⚡ Web Quick</span>'
                : '<span style="display:inline-block;font-size:0.65rem;padding:0.15rem 0.5rem;border-radius:999px;background:#f1f5f9;color:#64748b;font-weight:600">📚 Internal</span>';

        const confidenceBadge = confidence > 0 ? `<span style="font-size:0.65rem;color:${confidence > 75 ? 'var(--go)' : confidence > 50 ? 'var(--improve)' : 'var(--kill)'};font-weight:600">${confidence}% confidence</span>` : '';

        const sourcesHTML = sources.length ? `
            <div style="margin-top:0.75rem;padding-top:0.5rem;border-top:1px dashed var(--border-light)">
                <div style="font-size:0.7rem;font-weight:700;color:var(--text-dim);margin-bottom:0.35rem;text-transform:uppercase;letter-spacing:0.04em">Sources Used</div>
                <div style="display:flex;flex-wrap:wrap;gap:0.3rem">
                    ${sources.map(s => {
            const icon = s.type === 'web' ? '🌐' : '📄';
            const bgColor = s.type === 'web' ? '#dbeafe' : '#f1f5f9';
            const textColor = s.type === 'web' ? '#1d4ed8' : '#475569';
            const link = s.url ? `onclick="window.open('${s.url}','_blank')" style="cursor:pointer"` : '';
            return `<span ${link} style="font-size:0.68rem;padding:0.2rem 0.5rem;border-radius:999px;background:${bgColor};color:${textColor};display:inline-flex;align-items:center;gap:0.2rem">${icon} ${esc(s.title)}</span>`;
        }).join('')}
                </div>
            </div>` : '';

        return `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
                ${tierBadge}
                <div style="display:flex;gap:0.5rem;align-items:center">
                    ${confidenceBadge}
                    ${model ? `<span class="text-dim" style="font-size:0.6rem">${esc(model)}</span>` : ''}
                </div>
            </div>
            <div style="font-size:0.85rem;line-height:1.6;white-space:pre-wrap">${answer}</div>
            ${sourcesHTML}
        `;
    }

    // ── Validation via SSE with Activity Parsing ────────────
    function updateProgress(stepId) {
        document.querySelectorAll('.step-item').forEach(el => {
            el.classList.remove('active');
        });
        const current = document.getElementById(`step-${stepId}`);
        if (current) {
            current.classList.add('active');
            let prev = current.previousElementSibling;
            while (prev) {
                prev.classList.add('completed');
                prev.classList.remove('active');
                prev = prev.previousElementSibling;
            }
        }
    }

    function logActivity(msg, type) {
        const drawer = document.getElementById('drawerContent');
        if (!drawer) return;

        const d = new Date();
        const timeStr = d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerHTML = `<div class="log-entry-time">${timeStr}</div><div>${esc(msg)}</div>`;

        drawer.appendChild(entry);
        drawer.scrollTop = drawer.scrollHeight;
    }

    async function startValidation(ideaId) {
        const resArea = document.getElementById('validationResultsArea');
        const stepperContainer = document.getElementById('progressStepperContainer');

        if (!resArea) { await render(ideaId); return; }

        // Setup initial UI
        resArea.innerHTML = '<div style="text-align:center;padding:4rem"><div class="spinner" style="margin:0 auto"></div><p class="text-dim mt-2">Connecting to Orchestrator...</p></div>';
        stepperContainer.style.display = 'block';
        updateProgress('structuring');

        // Clear Activity Drawer
        const drawer = document.getElementById('drawerContent');
        if (drawer) drawer.innerHTML = '';
        app().toggleActivityDrawer(); // Auto-open drawer to show real-time actions

        try {
            const eventSource = new EventSource(`/api/ideas/${ideaId}/validate/stream`);

            eventSource.addEventListener('progress', (e) => {
                const data = JSON.parse(e.data);

                // Route generic progress to right steps
                if (data.message.includes('Structuring idea')) updateProgress('structuring');
                else if (data.message.includes('Executing agents')) updateProgress('analysis');
                else if (data.message.includes('Scoring agent models')) updateProgress('scoring');
                else if (data.message.includes('Refinement')) updateProgress('refinement');
                else if (data.message.includes('Executive summary')) updateProgress('exec');

                logActivity(data.message, 'started');
            });

            // If backend implements rich events via 'agent_status' event name:
            eventSource.addEventListener('agent_status', (e) => {
                const data = JSON.parse(e.data); // { agent: 'market_research', status: 'started'}
                logActivity(`Agent ${data.agent}: ${data.status}`, data.status === 'completed' ? 'completed' : 'started');
            });

            eventSource.addEventListener('error', (e) => {
                try {
                    const data = JSON.parse(e.data);
                    app().toast(data.error || 'Validation failed', 'error');
                } catch (_) { }
                eventSource.close();
                render(ideaId);
            });

            eventSource.addEventListener('complete', (e) => {
                eventSource.close();
                logActivity('Validation Pipeline Complete', 'completed');
                app().toast('Validation complete!', 'success');
                setTimeout(() => render(ideaId), 500);
            });

            eventSource.onerror = () => {
                eventSource.close();
                // Failsafe for environment unsupported SSE
                app().toast('Real-time connection dropped; falling back to sync wait...', 'info');
            };

        } catch (err) {
            app().toast(err.message, 'error');
        }
    }

    async function deleteIdea(ideaId) {
        if (!confirm('Delete this idea and all its validations?')) return;
        try {
            await app().api.deleteIdea(ideaId);
            app().toast('Idea deleted', 'info');
            window.location.hash = '#/';
        } catch (err) {
            app().toast(err.message, 'error');
        }
    }

    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    async function exportPDF() {
        if (window.PdfExport) {
            window.PdfExport.exportIdea(currentIdeaId);
        } else {
            app().toast('PDF export module loading…', 'info');
        }
    }

    function switchTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            if (btn.dataset.tab === tabId) {
                btn.classList.add('active');
                btn.style.color = 'var(--primary)';
                btn.style.borderBottomColor = 'var(--primary)';
                btn.style.fontWeight = '700';
            } else {
                btn.classList.remove('active');
                btn.style.color = 'var(--text-dim)';
                btn.style.borderBottomColor = 'transparent';
                btn.style.fontWeight = '600';
            }
        });

        // Hide all panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.style.display = 'none';
        });

        // Show active pane and initialize module if needed
        const activePane = document.getElementById(`tabContent-${tabId}`);
        if (activePane) activePane.style.display = 'block';

        if (tabId === 'tasks' && window.Tasks) {
            window.Tasks.init(currentIdeaId, `tabContent-${tabId}`);
        } else if (tabId === 'journal' && window.Journal) {
            window.Journal.init(currentIdeaId, `tabContent-${tabId}`);
        } else if (tabId === 'experiments' && window.Experiments) {
            window.Experiments.init(currentIdeaId, `tabContent-${tabId}`);
        } else if (tabId === 'validation' && window.StickyNotes && Object.keys(currentIdea.validations || {}).length > 0) {
            window.StickyNotes.init(currentIdeaId);
        }
    }

    function toggleRiskHeatmap(enabled) {
        document.querySelectorAll('.canvas-cell').forEach(cell => {
            if (!enabled) {
                cell.classList.remove('heatmap-overlay');
                cell.removeAttribute('data-risk-level');
                return;
            }

            cell.classList.add('heatmap-overlay');
            const risk = parseInt(cell.getAttribute('data-risk')) || 0;

            if (risk >= 7) {
                cell.setAttribute('data-risk-level', 'high');
            } else if (risk >= 4) {
                cell.setAttribute('data-risk-level', 'medium');
            } else {
                cell.setAttribute('data-risk-level', 'low');
            }
        });
    }

    return { render, startValidation, deleteIdea, openQA, submitQA, submitQuickAction, webValidate, exportPDF, switchTab, toggleRiskHeatmap };
})();
