/**
 * IdeaDetail.js — Full validation report, charts, business canvas, agent sections & Contextual Q&A
 */

window.IdeaDetail = (() => {
    const app = () => window.IdeaApp;
    const $content = () => document.getElementById('appContent');
    let charts = {};
    let currentIdeaId = null;

    async function render(ideaId, requestedTab = 'validation') {
        currentIdeaId = ideaId;
        const el = $content();
        el.innerHTML = '<div style="text-align:center;padding:4rem"><div class="spinner" style="margin:0 auto"></div><p class="text-dim mt-2">Loading idea…</p></div>';

        let idea;
        let tabs = [];
        try {
            idea = await app().api.getIdea(ideaId);
            tabs = await app().api.getTabs(ideaId);
        } catch (err) {
            el.innerHTML = `<div class="card" style="text-align:center; padding: 4rem;"><h2>Idea not found</h2><p class="text-dim">${err.message}</p><a href="#/" class="btn btn-outline mt-2">Back to Dashboard</a></div>`;
            return;
        }

        // Mapping route aliases to tab IDs
        const tabMap = {
            'execution': 'tasks',
            'tests': 'experiments'
        };
        const targetTab = tabMap[requestedTab] || requestedTab;

        // Start collaboration sync
        if (window.Collaboration) {
            window.Collaboration.startSync(ideaId);
        }

        const v = idea.validations && idea.validations[0];
        const analytics = idea.scoring_analytics || null;
        window.currentIdeaData = idea; // Store for workspace editing
        el.innerHTML = buildPage(idea, v, analytics, tabs);

        if (v) {
            renderCharts(v);
            loadPersistentActivity(v.id);
        }

        // Switch to requested tab
        switchTab(targetTab);

        // Initialize global sticky notes layer
        if (window.StickyNotes) {
            window.StickyNotes.init(ideaId);
        }
    }

    function buildPage(idea, v, analytics, tabs) {
        const hasVal = !!v;
        // Store globally for workspace rendering
        window.currentWorkspaceTabs = tabs;
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

            <div id="tabContent-validation" class="tab-pane active" style="display:block">
                <div id="validationResultsArea">
                    ${hasVal ? renderValidationResults(v, analytics) : renderValidationPrompt()}
                </div>
            </div>
            <div id="tabContent-workspace" class="tab-pane" style="display:none">
                <div id="workspaceContainer">
                    <!-- Dynamic Workspace content generated via JS -->
                </div>
            </div>
            <div id="tabContent-financials" class="tab-pane" style="display:none"></div>
            <div id="tabContent-risks" class="tab-pane" style="display:none"></div>
            <div id="tabContent-tasks" class="tab-pane" style="display:none"></div>
            <div id="tabContent-meetings" class="tab-pane" style="display:none"></div>
            <div id="tabContent-expenses" class="tab-pane" style="display:none"></div>
            <div id="tabContent-journal" class="tab-pane" style="display:none"></div>
            <div id="tabContent-experiments" class="tab-pane" style="display:none"></div>
            
            ${hasVal ? renderChatWidget(v.id) : ''}
        `;
    }

    function renderVersionSelector(idea) {
        if (!idea.validations || idea.validations.length <= 1) return '';
        const options = idea.validations.map((val, idx) =>
            `<option value="${val.id}">Iteration #${val.iteration} - ${app().formatDate(val.created_at)}</option>`
        ).join('');
        return `
            <select class="form-control" style="width: auto; height: 32px; padding: 0 0.5rem; font-size: 0.85rem;" onchange="window.IdeaDetail.switchVersion(this.value)">
                ${options}
            </select>
        `;
    }

    function renderChatWidget(valId) {
        return `
            <style>
                .chat-widget-toggle { position: fixed; bottom: 2rem; right: 2rem; width: 62px; height: 62px; border-radius: 50%; background: var(--primary); color: white; border: none; box-shadow: 0 8px 16px rgba(0,0,0,0.2); cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 1000; transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
                .chat-widget-toggle:hover { transform: scale(1.1) translateY(-2px); box-shadow: 0 12px 20px rgba(0,0,0,0.25); }
                .chat-widget-panel { position: fixed; bottom: 95px; right: 2rem; width: 380px; max-width: calc(100vw - 4rem); height: 550px; max-height: calc(100vh - 140px); background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; box-shadow: 0 15px 35px rgba(0,0,0,0.15); display: flex; flex-direction: column; overflow: hidden; z-index: 1000; opacity: 0; transform: translateY(30px) scale(0.95); transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); pointer-events: none; }
                .chat-widget-panel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: all; }
                .chat-widget-header { padding: 1.25rem; background: var(--primary); color: white; display: flex; justify-content: space-between; align-items: center; }
                .chat-widget-header h4 { margin: 0; font-size: 1rem; display: flex; align-items: center; gap: 0.6rem; color: white; letter-spacing: -0.01em; }
                .chat-widget-close { background: rgba(255,255,255,0.2); border: none; width: 28px; height: 28px; border-radius: 50%; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
                .chat-widget-close:hover { background: rgba(255,255,255,0.3); }
                .chat-widget-messages { flex: 1; overflow-y: auto; padding: 1.25rem; display: flex; flex-direction: column; gap: 1.25rem; background: var(--bg-main); }
                .chat-message { max-width: 88%; padding: 0.85rem 1.1rem; border-radius: 14px; font-size: 0.9rem; line-height: 1.5; position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
                .chat-message.user { align-self: flex-end; background: var(--primary); color: white; border-bottom-right-radius: 2px; font-weight: 500; }
                .chat-message.assistant { align-self: flex-start; background: var(--card-bg); border: 1px solid var(--border-light); color: var(--text); border-bottom-left-radius: 2px; }
                .chat-widget-input-area { padding: 1.25rem; border-top: 1px solid var(--border-light); background: var(--card-bg); }
                .chat-widget-input { display: flex; gap: 0.75rem; }
                .chat-widget-input input { flex: 1; padding: 0.65rem 1rem; border: 1px solid var(--border); border-radius: 8px; outline: none; background: var(--bg-main); color: var(--text); font-size: 0.9rem; }
                .chat-widget-input input:focus { border-color: var(--primary); }
                .chat-widget-input button { background: var(--primary); color: white; border: none; border-radius: 8px; width: 42px; height: 42px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: opacity 0.2s; }
                .chat-widget-input button:hover { opacity: 0.9; }
                .chat-rebuild-area { margin-top: 1rem; border-top: 1px dashed var(--border-light); padding-top: 1rem; }
            </style>
            
            <button class="chat-widget-toggle" onclick="window.IdeaDetail.toggleChatWidget(${valId})" title="Ask AI about this report">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            </button>
            
            <div class="chat-widget-panel" id="chatWidgetPanel">
                <div class="chat-widget-header">
                    <h4>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        Strategic AI Assistant
                    </h4>
                    <button class="chat-widget-close" onclick="window.IdeaDetail.toggleChatWidget(${valId})">&times;</button>
                </div>
                <div class="chat-widget-messages" id="chatWidgetMessages">
                    <div class="text-dim text-xs text-center">Chat session opened</div>
                </div>
                <div class="chat-widget-input-area">
                    <div class="chat-widget-input">
                        <input type="text" id="chatWidgetInput" placeholder="Ask about this validation..." onkeypress="if(event.key === 'Enter') window.IdeaDetail.sendChatMessage(${valId})">
                        <button onclick="window.IdeaDetail.sendChatMessage(${valId})" id="chatWidgetSendBtn">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        </button>
                    </div>
                    <div class="chat-rebuild-area">
                        <button class="btn btn-outline btn-sm w-100" onclick="window.IdeaDetail.promptRebuild()" style="font-weight:700; border-style:dashed;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                            Pivot & Rebuild Strategy
                        </button>
                    </div>
                </div>
            </div>
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
            <div class="sub-tabs mb-3" style="display:flex; gap:1.5rem; border-bottom:1px solid var(--border-light); justify-content:flex-start;">
                <button class="sub-tab-btn active" data-subtab="val-summary" onclick="window.IdeaDetail.switchSubTab('val-summary')">Summary</button>
                <button class="sub-tab-btn" data-subtab="val-canvas" onclick="window.IdeaDetail.switchSubTab('val-canvas')">Business Canvas</button>
                <button class="sub-tab-btn" data-subtab="val-agents" onclick="window.IdeaDetail.switchSubTab('val-agents')">Agent Deep Dives</button>
                <button class="sub-tab-btn" data-subtab="val-analytics" onclick="window.IdeaDetail.switchSubTab('val-analytics')">Intelligence & Charts</button>
                <button class="sub-tab-btn" data-subtab="val-roadmap" onclick="window.IdeaDetail.switchSubTab('val-roadmap')">Execution Roadmap</button>
            </div>

            <!-- Summary Tab -->
            <div id="subtab-val-summary" class="subtab-pane active" style="display:block">
                <div class="card mt-2 mb-3" style="margin-bottom: 2.5rem !important;">
                    ${renderExecutiveSummary(v.executive_summary, v.id)}
                </div>
                <div class="detail-scores">
                    <div class="card score-card" title="Weighted average of all agent evaluations.">
                        <div class="score-card-value" style="color:var(--${app().decisionClass(v.decision)})">${(v.final_score || 0).toFixed(1)}<span style="font-size:1rem;color:var(--text-muted)">/10</span></div>
                        <div class="score-card-label">Final Score</div>
                    </div>
                    <div class="card score-card" title="Strategic decision based on score threshold and risk profile.">
                        <div class="score-card-value">${v.decision || '—'}</div>
                        <div class="score-card-label">Decision</div>
                    </div>
                    <div class="card score-card" title="Statistical certainty of the AI agents' consensus.">
                        <div class="score-card-value" style="color:var(--info)">${(v.confidence_index || 0).toFixed(0)}%</div>
                        <div class="score-card-label">AI Confidence</div>
                    </div>
                    <div class="card score-card" title="Current number of refinement cycles applied.">
                        <div class="score-card-value" style="color:var(--primary)">#${v.iteration || 1}</div>
                        <div class="score-card-label">Refinement Iteration</div>
                    </div>
                </div>
                ${app().scoreBarHTML(v.final_score, v.decision)}
            </div>

            <!-- Canvas Tab -->
            <div id="subtab-val-canvas" class="subtab-pane" style="display:none">
                <div class="flex mb-2" style="justify-content:space-between; align-items:flex-end">
                    <h3 class="fw-700 m-0" style="font-size:1.25rem">Business Validation Canvas</h3>
                    <div class="flex gap-sm">
                        <button class="btn btn-primary btn-sm" onclick="window.StickyNotes && window.StickyNotes.createEmptySticky()" style="font-size:0.75rem; background:#fbbf24; color:#78350f; border:none;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                            Add Note
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="window.IdeaDetail.exportPDF()" style="font-size:0.75rem">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Export PDF
                        </button>
                    </div>
                </div>
                ${renderCanvas(v.structured_idea)}
            </div>

            <!-- Agents Tab -->
            <div id="subtab-val-agents" class="subtab-pane" style="display:none">
                <h3 class="fw-700 mb-2" style="font-size:1.25rem">Agent Deep Dives</h3>
                <div class="agent-sections" id="agentSections">
                    ${renderAgentSections(v.agent_outputs)}
                </div>
            </div>

            <!-- Analytics Tab -->
            <div id="subtab-val-analytics" class="subtab-pane" style="display:none">
                ${analytics && analytics.scenario_scores ? renderScenarioCards(analytics.scenario_scores) : ''}
                ${analytics && analytics.weighted_breakdown ? renderWeightedBreakdown(analytics.weighted_breakdown) : ''}
                ${analytics && analytics.sensitivity ? renderSensitivity(analytics.sensitivity) : ''}

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
            </div>

            <!-- Roadmap Tab -->
            <div id="subtab-val-roadmap" class="subtab-pane" style="display:none">
                ${renderRoadmap()}
            </div>
            
            <!-- Refinement Timeline -->
            ${v.refinement_history && v.refinement_history.length ? renderTimeline(v.refinement_history) : ''}
        `;
    }

    function renderExecutiveSummary(exec, valId) {
        // Handle loading/missing states
        if (!exec || !exec.executive_summary || exec.executive_summary.includes('failed')) {
            return `
                <div class="exec-summary" style="text-align:center; padding: 1.5rem;">
                    <div style="font-size: 2rem; margin-bottom: 1rem;">📝</div>
                    <h3 style="margin-bottom: 0.5rem;">Strategic Summary Pending</h3>
                    <p class="text-dim mb-3">The AI is still synthesizing the strategic analysis or the last attempt failed.</p>
                    <button class="btn btn-primary" id="retrySummaryBtn" onclick="window.IdeaDetail.regenerateSummary(${valId})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                        Generate Strategic Summary
                    </button>
                    <div id="summaryLoading" style="display:none; margin-top: 1rem;">
                        <div class="spinner" style="margin: 0 auto 0.5rem auto; width: 24px; height: 24px;"></div>
                        <span class="text-xs text-dim">AI is analyzing all agent outputs (Tier 1 Reasoning)...</span>
                    </div>
                </div>
            `;
        }

        const summary = exec.executive_summary || '';
        const strengths = exec.strengths || [];
        const weaknesses = exec.weaknesses || [];
        const recommendations = exec.recommendations || [];

        return `
            <div class="exec-summary">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 1rem;">
                    <h3 class="flex gap-sm" style="align-items:center; margin: 0;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        Executive Summary
                    </h3>
                    <button class="btn btn-outline btn-sm" onclick="window.IdeaDetail.regenerateSummary(${valId})" title="Refresh AI summary">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                    </button>
                </div>
                <p class="mt-1 text-dim" style="font-size:1.05rem; line-height: 1.6;">${esc(summary)}</p>
                <div class="mt-2" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.5rem;">
                    ${strengths.length ? `<div><h4 class="text-xs fw-800" style="color:var(--go); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">● Key Strengths</h4><ul class="exec-list">${strengths.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
                    ${weaknesses.length ? `<div><h4 class="text-xs fw-800" style="color:var(--kill); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">● Critical Risks</h4><ul class="exec-list">${weaknesses.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
                    ${recommendations.length ? `<div><h4 class="text-xs fw-800" style="color:var(--info); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">● Strategic Roadmap</h4><ul class="exec-list">${recommendations.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
                </div>
            </div>
        `;
    }

    async function regenerateSummary(valId) {
        const btn = document.getElementById('retrySummaryBtn');
        const loader = document.getElementById('summaryLoading');
        if (btn) btn.style.display = 'none';
        if (loader) loader.style.display = 'block';

        try {
            await app().apiFetch(`/validations/${valId}/summarize`, { method: 'POST' });

            // Refresh the whole page to show new summary and update metrics
            await render(currentIdeaId);
            app().toast('Strategic summary regenerated successfully', 'success');
        } catch (err) {
            app().toast('Failed to generate summary: ' + err.message, 'error');
            if (btn) btn.style.display = 'inline-flex';
            if (loader) loader.style.display = 'none';
        }
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

                const formatValue = (val) => {
                    if (val === null || val === undefined) return '—';
                    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
                    if (Array.isArray(val)) {
                        if (val.length === 0) return 'None';
                        return `<ul class="agent-val-list">${val.map(item => `<li>${formatValue(item)}</li>`).join('')}</ul>`;
                    }
                    if (typeof val === 'object') {
                        return Object.entries(val).map(([subK, subV]) =>
                            `<div class="agent-val-sub"><span class="text-dim">${subK.replace(/_/g, ' ')}:</span> ${formatValue(subV)}</div>`
                        ).join('');
                    }
                    return esc(String(val));
                };

                return `<dt>${esc(label)}</dt><dd>${formatValue(v)}</dd>`;
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

    function renderRoadmap() {
        const phases = [
            { id: 'ideation', label: 'Ideation', icon: '💡', status: 'completed', desc: 'Concept clear' },
            { id: 'validation', label: 'Validation', icon: '⚖️', status: 'active', desc: 'Current: Market/Tech proof' },
            { id: 'business', label: 'Business Model', icon: '💰', status: 'pending', desc: 'Unit economics & pricing' },
            { id: 'gtm', label: 'GTM Strategy', icon: '📈', status: 'pending', desc: 'Market entry & acquisition' },
            { id: 'scaling', label: 'Scaling', icon: '🚀', status: 'pending', desc: 'Growth & infrastructure' },
            { id: 'maturity', label: 'Maturity', icon: '🏢', status: 'pending', desc: 'Optimization & exit' }
        ];

        return `
            <div class="card" style="padding:2rem; overflow-x:auto;">
                <h3 style="margin-bottom:2rem; text-align:center; font-weight:800; font-size:1.5rem;">Strategic Execution Roadmap</h3>
                
                <div style="display:flex; justify-content:space-between; align-items:flex-start; min-width:800px; position:relative; padding-top:2rem;">
                    <!-- Connector Line -->
                    <div style="position:absolute; top:calc(2rem + 24px); left:50px; right:50px; height:4px; background:var(--border-light); z-index:1;">
                        <div style="height:100%; width:20%; background:var(--go); border-radius:999px;"></div>
                    </div>

                    ${phases.map((p, idx) => {
            const isActive = p.status === 'active';
            const isDone = p.status === 'completed';
            const color = isActive ? 'var(--info)' : isDone ? 'var(--go)' : 'var(--text-muted)';
            const bgColor = isActive ? 'var(--info-bg)' : isDone ? 'var(--go-bg)' : 'var(--bg-panel)';
            const borderColor = isActive ? 'var(--info)' : isDone ? 'var(--go)' : 'var(--border)';

            return `
                        <div style="display:flex; flex-direction:column; align-items:center; width:120px; position:relative; z-index:2;">
                            <div style="width:48px; height:48px; border-radius:50%; background:${bgColor}; border:2px solid ${borderColor}; display:flex; align-items:center; justify-content:center; font-size:1.25rem; margin-bottom:1rem; box-shadow:${isActive ? '0 0 15px rgba(59,130,246,0.3)' : 'none'};">
                                ${p.icon}
                            </div>
                            <div style="font-weight:700; font-size:0.85rem; color:${isActive ? 'var(--primary)' : 'var(--text-dim)'}; text-align:center; margin-bottom:0.25rem;">${p.label}</div>
                            <div style="font-size:0.7rem; color:var(--text-muted); text-align:center; line-height:1.2;">${p.desc}</div>
                            ${isActive ? '<span class="badge badge-info" style="margin-top:0.75rem; font-size:0.6rem;">CURRENT STAGE</span>' : ''}
                        </div>
                        `;
        }).join('')}
                </div>

                <div class="grid grid-3 gap-2 mt-3" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:1rem; margin-top:3rem;">
                    <div class="card" style="background:var(--info-bg); border-left:4px solid var(--info); padding:1rem;">
                        <h4 class="text-xs fw-800 uppercase" style="color:var(--info); margin-bottom:0.5rem; font-size:0.75rem;">Next Milestones</h4>
                        <ul class="exec-list mb-0" style="padding-left:1.25rem;">
                            <li class="text-xs">Define detailed unit economics</li>
                            <li class="text-xs">Develop GTM acquisition funnel</li>
                            <li class="text-xs">Set up experimental landing page</li>
                        </ul>
                    </div>
                    <div class="card" style="padding:1rem;">
                        <h4 class="text-xs fw-800 uppercase" style="color:var(--primary); margin-bottom:0.5rem; font-size:0.75rem;">Time to Market</h4>
                        <div style="font-size:1.5rem; font-weight:800;">4-6 Months</div>
                        <p class="text-xs text-dim">Projected based on current tech feasibility.</p>
                    </div>
                    <div class="card" style="padding:1rem;">
                        <h4 class="text-xs fw-800 uppercase" style="color:var(--primary); margin-bottom:0.5rem; font-size:0.75rem;">Resource Intensity</h4>
                        <div style="font-size:1.5rem; font-weight:800;">Medium</div>
                        <p class="text-xs text-dim">Requires 2 devs + 1 marketing lead.</p>
                    </div>
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

    function logActivity(msg, type, timeOverride = null) {
        const drawer = document.getElementById('drawerContent');
        if (!drawer) return;

        const d = timeOverride ? new Date(timeOverride) : new Date();
        const timeStr = d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerHTML = `<div class="log-entry-time">${timeStr}</div><div>${esc(msg)}</div>`;

        drawer.appendChild(entry);
        drawer.scrollTop = drawer.scrollHeight;
    }

    async function loadPersistentActivity(validationId) {
        const drawer = document.getElementById('drawerContent');
        if (!drawer) return;

        try {
            const messages = await app().apiFetch(`/validations/${validationId}/timeline`);
            if (messages && messages.length > 0) {
                // Keep existing logs if any (streaming), otherwise clear
                // For a reload, we clear
                drawer.innerHTML = '<div class="text-xs text-dim mb-2 uppercase fw-700" style="opacity:0.5; border-bottom:1px solid var(--border-light); padding-bottom:0.25rem;">Historical Reasoning Logs</div>';

                messages.forEach(m => {
                    logActivity(`Agent ${m.agent_name}: ${m.content}`, m.status, m.created_at);
                });
            }
        } catch (err) {
            console.error("Failed to load timeline:", err);
        }
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
        // Hide all panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.style.display = 'none';
            pane.classList.remove('active');
        });

        // Show active pane
        const activePane = document.getElementById(`tabContent-${tabId}`);
        if (activePane) {
            activePane.style.display = 'block';
            activePane.classList.add('active');
        }

        // Sync sidebar active state
        document.querySelectorAll('.sidebar-link').forEach(link => {
            const linkRoute = link.dataset.route;
            // Map module names to routes
            const routeMap = {
                'validation': '/validation',
                'workspace': '/workspace',
                'financials': '/financials',
                'risks': '/risks',
                'tasks': '/execution',
                'meetings': '/meetings',
                'expenses': '/expenses',
                'journal': '/journal',
                'experiments': '/tests'
            };
            const targetRoute = routeMap[tabId];
            link.classList.toggle('active', linkRoute === targetRoute);
        });

        // Initialize module if needed
        if (tabId === 'tasks' && window.Tasks) {
            window.Tasks.init(currentIdeaId, `tabContent-${tabId}`);
        } else if (tabId === 'journal' && window.Journal) {
            window.Journal.init(currentIdeaId, `tabContent-${tabId}`);
        } else if (tabId === 'experiments' && window.Experiments) {
            window.Experiments.init(currentIdeaId, `tabContent-${tabId}`);
        } else if (tabId === 'financials' && window.Financials) {
            window.Financials.init(currentIdeaId, `tabContent-${tabId}`);
        } else if (tabId === 'risks' && window.Risks) {
            window.Risks.init(currentIdeaId, `tabContent-${tabId}`);
        } else if (tabId === 'meetings' && window.Meetings) {
            window.Meetings.init(currentIdeaId, `tabContent-${tabId}`);
        } else if (tabId === 'expenses' && window.Expenses) {
            window.Expenses.init(currentIdeaId, `tabContent-${tabId}`);
        } else if (tabId === 'workspace' && window.Workspace) {
            window.Workspace.init(currentIdeaId, 'workspaceContainer');
        } else if (tabId === 'validation' && window.StickyNotes) {
            window.StickyNotes.init(currentIdeaId);
        }
    }

    function switchSubTab(subtabId) {
        document.querySelectorAll('.sub-tab-btn').forEach(btn => {
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

        document.querySelectorAll('.subtab-pane').forEach(pane => {
            pane.style.display = (pane.id === `subtab-${subtabId}`) ? 'block' : 'none';
        });

        // Re-render charts if entering analytics tab
        if (subtabId === 'val-analytics' && currentIdea?.validations?.[0]) {
            setTimeout(() => renderCharts(currentIdea.validations[0]), 50);
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

    // ── Chat Widget & Version Switching ─────────────────────────────────

    async function toggleChatWidget(valId) {
        const panel = document.getElementById('chatWidgetPanel');
        if (!panel) return;

        const isOpen = panel.classList.contains('open');
        if (isOpen) {
            panel.classList.remove('open');
        } else {
            panel.classList.add('open');
            await loadChatHistory(valId);
            setTimeout(() => {
                const input = document.getElementById('chatWidgetInput');
                if (input) input.focus();
            }, 300);
        }
    }

    async function loadChatHistory(valId) {
        const msgContainer = document.getElementById('chatWidgetMessages');
        if (!msgContainer) return;

        try {
            const history = await app().api.getChatHistory(valId);
            msgContainer.innerHTML = '';
            if (!history || history.length === 0) {
                msgContainer.innerHTML = '<div class="text-dim text-xs text-center mt-2">Chat session opened. Ask me anything about this report!</div>';
            } else {
                history.forEach(msg => {
                    msgContainer.innerHTML += `<div class="chat-message ${msg.role}">${esc(msg.content)}</div>`;
                });
            }
            msgContainer.scrollTop = msgContainer.scrollHeight;
        } catch (err) {
            console.error("Failed to load chat:", err);
            app().toast("Failed to load chat history.", "error");
        }
    }

    async function sendChatMessage(valId) {
        const input = document.getElementById('chatWidgetInput');
        if (!input) return;

        const content = input.value.trim();
        if (!content) return;

        input.value = '';
        input.disabled = true;
        const btn = document.getElementById('chatWidgetSendBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;border-top-color:transparent"></span>';
        }

        const msgContainer = document.getElementById('chatWidgetMessages');
        // Remove empty state message if present
        const em = msgContainer.querySelector('.text-center');
        if (em) em.remove();

        msgContainer.innerHTML += `<div class="chat-message user">${esc(content)}</div>`;
        msgContainer.scrollTop = msgContainer.scrollHeight;

        try {
            const response = await app().api.postChatMessage(valId, content);
            msgContainer.innerHTML += `<div class="chat-message assistant">${esc(response.content)}</div>`;
            msgContainer.scrollTop = msgContainer.scrollHeight;
        } catch (err) {
            app().toast(err.message, 'error');
        } finally {
            input.disabled = false;
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
            }
            input.focus();
        }
    }

    async function promptRebuild() {
        if (!currentIdeaId) return;
        const suggestion = prompt("Strategic Pivot: Enter instructions for the AI to completely rebuild this startup idea (e.g., 'Pivot to B2B targeting restaurants only'):");
        if (!suggestion || !suggestion.trim()) return;

        try {
            const panel = document.getElementById('chatWidgetPanel');
            if (panel) panel.classList.remove('open');
            app().toast('Applying pivot instructions...', 'info');
            await app().api.rebuildIdea(currentIdeaId, suggestion.trim());
            // Now start the validation pipeline to stream the rebuild
            startValidation(currentIdeaId);
        } catch (err) {
            app().toast(err.message, 'error');
        }
    }

    function switchVersion(valId) {
        // Find the idea data
        app().api.getIdea(currentIdeaId).then(idea => {
            const v = idea.validations.find(val => val.id == parseInt(valId));
            if (v) {
                const analytics = idea.scoring_analytics || null;
                $content().innerHTML = buildPage(idea, v, analytics, window.currentWorkspaceTabs);
                renderCharts(v);

                // Select the option explicitly
                const selector = document.querySelector('select[onchange^="window.IdeaDetail.switchVersion"]');
                if (selector) selector.value = valId;
            }
        });
    }

    // ── V2 OS Workspace Dynamic Tabs & Blocks ─────────────────────────────

    let currentTabId = null;
    let quillInstances = {};

    function renderWorkspaceContainer() {
        const container = document.getElementById('workspaceContainer');
        if (!container) return;

        const tabs = window.currentWorkspaceTabs || [];

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
                <div>
                    <h3 style="margin:0; font-weight:800;">Strategic Workspace</h3>
                    <p class="text-dim text-xs">Innovation scratchpad & project documentation</p>
                </div>
                <button class="btn btn-outline btn-sm" onclick="window.IdeaDetail.createWorkspaceTab()">+ New Tab</button>
            </div>
            <div class="workspace-tabs" style="display:flex; gap:0.5rem; overflow-x:auto; padding-bottom:0.75rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-light);">
                <button class="btn btn-sm ${currentTabId === 'core' ? 'btn-primary' : 'btn-outline'}" onclick="window.IdeaDetail.switchWorkspaceTab('core')" style="border-radius:20px;">
                    🎯 Core Infrastructure
                </button>
        `;

        if (tabs.length === 0 && !currentTabId) currentTabId = 'core';

        tabs.forEach(t => {
            const isActive = (currentTabId === t.id);
            html += `
                <button class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline'}" onclick="window.IdeaDetail.switchWorkspaceTab(${t.id})" style="border-radius:20px;">
                    ${esc(t.name)}
                </button>
            `;
        });

        html += `</div>`;

        if (currentTabId === 'core') {
            html += renderCoreIdeaDetails();
        } else if (currentTabId) {
            html += `
                <div style="display:flex; justify-content:flex-end; margin-bottom: 1rem;">
                    <button class="btn btn-outline btn-sm" onclick="window.IdeaDetail.createBlock('text')" title="Add Text Block">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Add Note Block
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="window.IdeaDetail.deleteWorkspaceTab(${currentTabId})" style="margin-left: 0.5rem;">
                         Delete Tab
                    </button>
                </div>
                <div id="workspaceBlocks" style="min-height: 200px;"></div>
            `;
        }

        container.innerHTML = html;

        if (currentTabId && currentTabId !== 'core') {
            const activeTab = tabs.find(t => t.id === currentTabId);
            if (activeTab) renderBlocks(activeTab.blocks);
        }
    }

    function renderCoreIdeaDetails() {
        // Find current idea from public API helper or store
        const idea = window.currentIdeaData;
        if (!idea) return '<p class="text-dim">Loading idea context...</p>';

        return `
            <div class="card" style="padding:1.5rem; border-left:4px solid var(--go);">
                <div style="margin-bottom:1.5rem;">
                    <label style="display:block; font-size:0.75rem; text-transform:uppercase; font-weight:800; color:var(--text-dim); margin-bottom:0.5rem;">Startup Mission (Title)</label>
                    <input type="text" id="editIdeaTitle" class="form-control" value="${esc(idea.title)}" style="font-weight:700; font-size:1.1rem;">
                </div>
                <div style="margin-bottom:1.5rem;">
                    <label style="display:block; font-size:0.75rem; text-transform:uppercase; font-weight:800; color:var(--text-dim); margin-bottom:0.5rem;">Problem & Solution Description</label>
                    <textarea id="editIdeaDesc" class="form-control" style="min-height:120px; line-height:1.6;">${esc(idea.description)}</textarea>
                </div>
                <div style="display:flex; justify-content:flex-end;">
                    <button class="btn btn-primary" onclick="window.IdeaDetail.saveCoreDetails()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:8px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Apply Core Strategic Changes
                    </button>
                </div>
            </div>
        `;
    }

    async function saveCoreDetails() {
        const title = document.getElementById('editIdeaTitle').value.trim();
        const description = document.getElementById('editIdeaDesc').value.trim();
        if (!title || !description) return;

        try {
            await app().api.updateIdea(currentIdeaId, { title, description });
            app().toast('Core strategy updated', 'success');
            setTimeout(() => render(currentIdeaId, 'workspace'), 500);
        } catch (e) {
            app().toast(e.message, 'error');
        }
    }

    function switchWorkspaceTab(tabId) {
        currentTabId = tabId;
        renderWorkspaceContainer();
    }

    async function createWorkspaceTab() {
        const name = prompt("Enter Tab Name:");
        if (!name) return;
        try {
            const newTab = await app().api.createTab(currentIdeaId, { name, order: window.currentWorkspaceTabs.length });
            window.currentWorkspaceTabs.push({ ...newTab, blocks: [] });
            switchWorkspaceTab(newTab.id);
            app().toast('Tab created', 'success');
        } catch (e) {
            app().toast(e.message, 'error');
        }
    }

    async function deleteWorkspaceTab(tabId) {
        if (!confirm('Are you sure you want to delete this tab and all its blocks?')) return;
        try {
            await app().api.deleteTab(tabId);
            window.currentWorkspaceTabs = window.currentWorkspaceTabs.filter(t => t.id !== tabId);
            currentTabId = window.currentWorkspaceTabs.length > 0 ? window.currentWorkspaceTabs[0].id : null;
            renderWorkspaceContainer();
            app().toast('Tab deleted', 'success');
        } catch (e) {
            app().toast(e.message, 'error');
        }
    }

    function renderBlocks(blocks) {
        const container = document.getElementById('workspaceBlocks');
        if (!container) return;

        // Clear old quills
        quillInstances = {};

        container.innerHTML = '';

        // Add a primary "Idea Context" block if we're on the first tab and it's empty
        if (blocks.length === 0) {
            container.innerHTML = `
                <div class="card" style="text-align:center; padding:3rem; border:2px dashed var(--border-light);">
                    <p class="text-dim">This workspace is your strategic sandbox. Add a block to start drafting or refining.</p>
                    <button class="btn btn-primary btn-sm mt-1" onclick="window.IdeaDetail.createBlock('text')">Add First Note</button>
                </div>
            `;
            return;
        }

        blocks.sort((a, b) => a.order - b.order).forEach(block => {
            const div = document.createElement('div');
            div.className = 'workspace-block card mb-3';
            div.dataset.id = block.id;
            div.style.padding = '1.25rem';
            div.style.position = 'relative';
            div.style.borderLeft = '4px solid var(--primary)';

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                    <div style="font-size:0.75rem; text-transform:uppercase; font-weight:800; color:var(--text-dim);">Innovation Note</div>
                    <div style="display:flex; gap:0.5rem; align-items:center;">
                        <div class="block-drag-handle" style="cursor: grab; color: var(--text-dim); opacity:0.5;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                        </div>
                        <div class="block-delete" style="cursor: pointer; color: var(--kill); opacity:0.7;" onclick="window.IdeaDetail.deleteBlock(${block.id})" title="Delete Block">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </div>
                    </div>
                </div>
                <div class="block-editor-container" id="editor-${block.id}" style="margin-bottom:1rem;"></div>
                <div style="display:flex; justify-content:flex-end;">
                    <button class="btn btn-primary btn-sm" onclick="window.IdeaDetail.saveBlock(${block.id})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Save Note
                    </button>
                </div>
            `;
            container.appendChild(div);

            // Init Quill
            const quill = new Quill(`#editor-${block.id}`, {
                theme: 'snow',
                placeholder: 'Start writing your strategic notes...',
                modules: {
                    toolbar: [
                        [{ 'header': [2, 3, false] }],
                        ['bold', 'italic', 'underline'],
                        [{ 'list': 'bullet' }],
                        ['link', 'clean']
                    ]
                }
            });
            // Load content
            if (block.content && block.content.html) {
                quill.clipboard.dangerouslyPasteHTML(block.content.html);
            } else if (block.content && block.content.text) {
                quill.insertText(0, block.content.text);
            }
            quillInstances[block.id] = quill;
        });

        // Init SortableJS
        Sortable.create(container, {
            handle: '.block-drag-handle',
            animation: 150,
            onEnd: async function (evt) {
                const itemEls = container.querySelectorAll('.workspace-block');
                const updates = Array.from(itemEls).map((el, i) => {
                    return app().apiFetch(`/blocks/${el.dataset.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ order: i })
                    });
                });
                try {
                    await Promise.all(updates);
                    app().toast('Order saved', 'info');
                } catch (e) {
                    app().toast('Failed to save order', 'error');
                }
            }
        });
    }

    async function createBlock(type = 'text') {
        const t = window.currentWorkspaceTabs.find(tx => tx.id === currentTabId);
        if (!t) return;
        try {
            const block = await app().api.createBlock(currentTabId, {
                block_type: type,
                content: { html: '' },
                order: t.blocks.length
            });
            t.blocks.push(block);
            renderWorkspaceContainer();
            app().toast('Block added', 'success');
        } catch (e) {
            app().toast(e.message, 'error');
        }
    }

    async function saveBlock(blockId) {
        const quill = quillInstances[blockId];
        if (!quill) return;
        const html = quill.root.innerHTML;
        const text = quill.getText();
        try {
            const btn = document.querySelector(`.workspace-block[data-id="${blockId}"] button`);
            if (btn) btn.textContent = 'Saving...';

            await app().api.updateBlock(blockId, { content: { html, text } });

            const t = window.currentWorkspaceTabs.find(tx => tx.id === currentTabId);
            if (t) {
                const b = t.blocks.find(bx => String(bx.id) === String(blockId));
                if (b) b.content = { html, text };
            }
            app().toast('Block saved', 'success');

            if (btn) btn.textContent = 'Save Content';
        } catch (e) {
            app().toast(e.message, 'error');
        }
    }

    async function deleteBlock(blockId) {
        if (!confirm('Delete this block?')) return;
        try {
            await app().api.deleteBlock(blockId);
            const t = window.currentWorkspaceTabs.find(tx => tx.id === currentTabId);
            if (t) {
                t.blocks = t.blocks.filter(bx => String(bx.id) !== String(blockId));
            }
            renderWorkspaceContainer();
            app().toast('Block deleted', 'success');
        } catch (e) {
            app().toast(e.message, 'error');
        }
    }


    return {
        render, switchTab, switchSubTab, startValidation, deleteIdea, exportPDF,
        openQA, submitQA, submitQuickAction, webValidate, toggleRiskHeatmap,
        toggleChatWidget, sendChatMessage, promptRebuild, regenerateSummary,
        // Workspace exports
        switchWorkspaceTab, createWorkspaceTab, deleteWorkspaceTab,
        createBlock, saveBlock, deleteBlock
    };
})();
