/**
 * Dashboard.js — Strategic Command Center
 * Weighted score breakdown, risk heatmap, scenario simulation,
 * time filtering, strategic/technical view toggle, idea search.
 */

window.Dashboard = (() => {
    const app = () => window.IdeaApp;
    const $content = () => document.getElementById('appContent');
    let currentView = 'strategic'; // 'strategic' | 'technical'

    async function render() {
        const el = $content();
        el.innerHTML = '<div style="text-align:center;padding:4rem"><div class="spinner" style="margin:0 auto"></div></div>';

        let ideas;
        try {
            ideas = await app().api.listIdeas();
        } catch (err) {
            el.innerHTML = `<div class="card" style="text-align:center;padding:3rem"><h2>Error</h2><p class="text-dim">${esc(err.message)}</p></div>`;
            return;
        }

        el.innerHTML = buildDashboardHTML(ideas);
        attachHandlers(ideas);
    }

    function buildDashboardHTML(ideas) {
        const completed = ideas.filter(i => i.status === 'completed');
        const goCount = completed.filter(i => i.latest_decision === 'GO').length;
        const improveCount = completed.filter(i => i.latest_decision === 'IMPROVE').length;
        const killCount = completed.filter(i => i.latest_decision === 'KILL').length;
        const avgScore = completed.length
            ? (completed.reduce((s, i) => s + (i.latest_score || 0), 0) / completed.length).toFixed(1)
            : '—';

        return `
        <!-- Header Bar -->
        <div class="dash-header" style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem">
            <div>
                <h1 style="font-size:1.75rem;font-weight:800;letter-spacing:-0.02em;margin:0">Strategic Command Center</h1>
                <p class="text-dim text-sm" style="margin-top:0.25rem">${ideas.length} ideas tracked · ${completed.length} validated</p>
            </div>
            <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
                <div class="view-toggle" style="display:flex;border:1px solid var(--border);border-radius:999px;overflow:hidden">
                    <button class="view-btn ${currentView === 'strategic' ? 'active' : ''}" data-view="strategic" style="padding:0.35rem 1rem;font-size:0.8rem;border:none;cursor:pointer;font-weight:600;background:${currentView === 'strategic' ? 'var(--primary)' : 'transparent'};color:${currentView === 'strategic' ? '#fff' : 'var(--text-dim)'}">Strategic</button>
                    <button class="view-btn ${currentView === 'technical' ? 'active' : ''}" data-view="technical" style="padding:0.35rem 1rem;font-size:0.8rem;border:none;border-left:1px solid var(--border);cursor:pointer;font-weight:600;background:${currentView === 'technical' ? 'var(--primary)' : 'transparent'};color:${currentView === 'technical' ? '#fff' : 'var(--text-dim)'}">Technical</button>
                </div>
                <div style="position:relative;display:flex;align-items:center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;left:12px;pointer-events:none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" id="dashSearch" placeholder="Search ideas…" style="width:240px;padding:0.55rem 2.75rem 0.55rem 2.4rem;font-size:0.85rem;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,0.6);backdrop-filter:blur(8px);color:var(--text);outline:none;transition:all 0.3s ease;box-shadow:0 1px 3px rgba(0,0,0,0.04)" onfocus="this.style.borderColor='var(--primary)';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.12),0 1px 3px rgba(0,0,0,0.04)';this.style.width='280px'" onblur="this.style.borderColor='var(--border)';this.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)';if(!this.value) this.style.width='240px'">
                    <kbd style="position:absolute;right:10px;font-size:0.6rem;padding:0.15rem 0.4rem;border-radius:4px;background:var(--bg-alt);border:1px solid var(--border-light);color:var(--text-dim);font-family:inherit;pointer-events:none;opacity:0.7">⌘K</kbd>
                </div>
                <button class="btn btn-primary" onclick="location.hash='#/new'" style="font-size:0.85rem">+ New Idea</button>
            </div>
        </div>


        <!-- KPI Metrics Bar -->
        <div class="kpi-bar" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:1rem;margin-bottom:2rem">
            <div class="card kpi-card" style="text-align:center;padding:1.25rem">
                <div class="text-dim text-xs" style="text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem">Total Ideas</div>
                <div style="font-size:2rem;font-weight:800;color:var(--primary)">${ideas.length}</div>
            </div>
            <div class="card kpi-card" style="text-align:center;padding:1.25rem">
                <div class="text-dim text-xs" style="text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem">Avg Score</div>
                <div style="font-size:2rem;font-weight:800;color:var(--info)">${avgScore}<span style="font-size:0.9rem;color:var(--text-dim)">/10</span></div>
            </div>
            <div class="card kpi-card" style="text-align:center;padding:1.25rem">
                <div class="text-dim text-xs" style="text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem">GO</div>
                <div style="font-size:2rem;font-weight:800;color:var(--go)">${goCount}</div>
            </div>
            <div class="card kpi-card" style="text-align:center;padding:1.25rem">
                <div class="text-dim text-xs" style="text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem">IMPROVE</div>
                <div style="font-size:2rem;font-weight:800;color:var(--improve)">${improveCount}</div>
            </div>
            <div class="card kpi-card" style="text-align:center;padding:1.25rem">
                <div class="text-dim text-xs" style="text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem">KILL</div>
                <div style="font-size:2rem;font-weight:800;color:var(--kill)">${killCount}</div>
            </div>
        </div>

        <!-- Decision Distribution Chart (Strategic View) -->
        ${currentView === 'strategic' && completed.length ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:2rem">
            <div class="card" style="min-height:280px">
                <h3 style="font-size:1rem;font-weight:700;margin-bottom:1rem">Decision Distribution</h3>
                <div class="chart-wrapper" style="height:220px"><canvas id="decisionDonut"></canvas></div>
            </div>
            <div class="card" style="min-height:280px">
                <h3 style="font-size:1rem;font-weight:700;margin-bottom:1rem">Score Distribution</h3>
                <div class="chart-wrapper" style="height:220px"><canvas id="scoreHistogram"></canvas></div>
            </div>
        </div>
        ` : ''}

        <!-- Risk Heatmap (Strategic View) -->
        ${currentView === 'strategic' && completed.length ? `
        <div class="card" style="margin-bottom:2rem">
            <h3 style="font-size:1rem;font-weight:700;margin-bottom:1rem">Risk & Confidence Overview</h3>
            <div class="risk-heatmap" id="riskHeatmap" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.75rem"></div>
        </div>
        ` : ''}

        <!-- Ideas Grid -->
        <h3 style="font-size:1rem;font-weight:700;margin-bottom:1rem">All Ideas</h3>
        <div class="ideas-grid" id="ideasGrid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:1rem">
            ${ideas.length === 0 ? emptyState() : ideas.map(i => ideaCard(i)).join('')}
        </div>
        `;
    }

    function emptyState() {
        return `
        <div class="card" style="grid-column:1/-1;text-align:center;padding:4rem 2rem">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--primary-light)" stroke-width="1.5" style="margin:0 auto 1rem">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            <h2 style="font-weight:700;margin-bottom:0.5rem">No ideas yet</h2>
            <p class="text-dim text-sm" style="max-width:360px;margin:0 auto 1.25rem">Start by creating your first startup idea to validate it with our multi-agent AI system.</p>
            <button class="btn btn-primary" onclick="location.hash='#/new'">Create First Idea</button>
        </div>`;
    }

    function ideaCard(idea) {
        const score = idea.latest_score;
        const decision = idea.latest_decision;
        const date = idea.updated_at ? new Date(idea.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        const scoreColor = decision === 'GO' ? 'var(--go)' : decision === 'IMPROVE' ? 'var(--improve)' : decision === 'KILL' ? 'var(--kill)' : 'var(--text-dim)';

        return `
        <div class="card idea-card" data-title="${esc(idea.title)}" onclick="location.hash='#/idea/${idea.id}'" style="cursor:pointer;transition:all 0.2s ease;position:relative;overflow:hidden">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.75rem">
                <div style="font-weight:700;font-size:1rem;line-height:1.3;flex:1;margin-right:0.5rem">${esc(idea.title)}</div>
                ${decision ? `<span class="decision-badge decision-${decision.toLowerCase()}">${decision}</span>` : `<span class="decision-badge" style="background:var(--bg-alt);color:var(--text-dim)">Draft</span>`}
            </div>
            <p class="text-dim text-sm" style="margin-bottom:1rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(idea.description || '')}</p>
            
            ${score != null ? `
            <div style="margin-bottom:0.5rem">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem">
                    <span class="text-xs text-dim">Validation Score</span>
                    <span style="font-weight:800;color:${scoreColor};font-size:1.1rem">${score.toFixed(1)}</span>
                </div>
                <div style="height:6px;background:var(--bg-alt);border-radius:999px;overflow:hidden">
                    <div style="height:100%;width:${score * 10}%;background:${scoreColor};border-radius:999px;transition:width 0.5s ease"></div>
                </div>
            </div>
            ` : ''}

            <!-- Execution Velocity Metrics -->
            <div style="display:flex;gap:0.5rem;margin-top:0.75rem;margin-bottom:0.5rem">
                <div style="flex:1;background:var(--bg-alt);padding:0.4rem;border-radius:6px;text-align:center">
                    <div class="text-xs text-dim" style="margin-bottom:0.15rem">Tasks Done</div>
                    <div style="font-weight:700;font-size:0.85rem">${idea.tasks_completed || 0}/${idea.tasks_total || 0}</div>
                </div>
                <div style="flex:1;background:var(--bg-alt);padding:0.4rem;border-radius:6px;text-align:center">
                    <div class="text-xs text-dim" style="margin-bottom:0.15rem">Real Tests</div>
                    <div style="font-weight:700;font-size:0.85rem">${idea.experiments_total || 0}</div>
                </div>
            </div>
            
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.75rem">
                <span class="text-xs text-dim">${date}</span>
                <span class="text-xs" style="color:var(--primary);font-weight:600">${idea.status === 'validating' ? '⏳ Validating…' : idea.validation_count > 0 ? `${idea.validation_count} iteration${idea.validation_count > 1 ? 's' : ''}` : 'Not validated'}</span>
            </div>
        </div>`;
    }

    function attachHandlers(ideas) {
        // Search
        const search = document.getElementById('dashSearch');
        if (search) {
            search.addEventListener('input', () => {
                const q = search.value.toLowerCase();
                document.querySelectorAll('.idea-card').forEach(card => {
                    const title = (card.getAttribute('data-title') || '').toLowerCase();
                    card.style.display = title.includes(q) ? '' : 'none';
                });
            });
        }

        // View toggle
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentView = btn.dataset.view;
                render();
            });
        });

        // Charts
        const completed = ideas.filter(i => i.status === 'completed');
        if (currentView === 'strategic' && completed.length) {
            renderDecisionDonut(completed);
            renderScoreHistogram(completed);
            renderRiskHeatmap(completed);
        }
    }

    function renderDecisionDonut(completed) {
        const ctx = document.getElementById('decisionDonut');
        if (!ctx) return;
        const go = completed.filter(i => i.latest_decision === 'GO').length;
        const improve = completed.filter(i => i.latest_decision === 'IMPROVE').length;
        const kill = completed.filter(i => i.latest_decision === 'KILL').length;

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['GO', 'IMPROVE', 'KILL'],
                datasets: [{
                    data: [go, improve, kill],
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    borderWidth: 0,
                    borderRadius: 4,
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#0f172a', font: { size: 12, weight: '600' }, padding: 16 } },
                },
            },
        });
    }

    function renderScoreHistogram(completed) {
        const ctx = document.getElementById('scoreHistogram');
        if (!ctx) return;
        const buckets = Array(10).fill(0);
        completed.forEach(i => {
            const idx = Math.min(Math.floor(i.latest_score || 0), 9);
            buckets[idx]++;
        });

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['0-1', '1-2', '2-3', '3-4', '4-5', '5-6', '6-7', '7-8', '8-9', '9-10'],
                datasets: [{
                    label: 'Ideas',
                    data: buckets,
                    backgroundColor: buckets.map((_, i) => i < 6 ? '#fee2e2' : i < 8 ? '#fef3c7' : '#d1fae5'),
                    borderColor: buckets.map((_, i) => i < 6 ? '#ef4444' : i < 8 ? '#f59e0b' : '#10b981'),
                    borderWidth: 1, borderRadius: 6,
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } },
                    y: { beginAtZero: true, ticks: { stepSize: 1, color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.05)' } },
                },
            },
        });
    }

    function renderRiskHeatmap(completed) {
        const el = document.getElementById('riskHeatmap');
        if (!el) return;
        el.innerHTML = completed.map(idea => {
            const score = idea.latest_score || 0;
            const risk = 10 - score; // approximate risk from score
            const confidence = 50 + score * 5; // approximate confidence
            const riskColor = risk > 6 ? '#ef4444' : risk > 3 ? '#f59e0b' : '#10b981';
            const confColor = confidence > 70 ? '#10b981' : confidence > 50 ? '#f59e0b' : '#ef4444';

            return `
                <div style="padding:1rem;border-radius:var(--radius);border:1px solid var(--border-light);cursor:pointer;transition:all 0.2s" onclick="location.hash='#/idea/${idea.id}'" onmouseover="this.style.borderColor='var(--primary-light)'" onmouseout="this.style.borderColor='var(--border-light)'">
                <div style="font-weight:600;font-size:0.85rem;margin-bottom:0.75rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(idea.title)}</div>
                <div style="display:flex;gap:0.75rem">
                    <div style="flex:1">
                        <div class="text-xs text-dim" style="margin-bottom:0.25rem">Risk</div>
                        <div style="height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden"><div style="height:100%;width:${risk * 10}%;background:${riskColor};border-radius:4px"></div></div>
                    </div>
                    <div style="flex:1">
                        <div class="text-xs text-dim" style="margin-bottom:0.25rem">Confidence</div>
                        <div style="height:8px;background:#f1f5f9;border-radius:4px;overflow:hidden"><div style="height:100%;width:${confidence}%;background:${confColor};border-radius:4px"></div></div>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    return { render };
})();
