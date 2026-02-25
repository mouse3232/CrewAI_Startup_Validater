/**
 * Dashboard.js — Strategic Command Center
 * Weighted score breakdown, risk heatmap, scenario simulation,
 * time filtering, strategic/technical view toggle, idea search.
 */

window.Dashboard = (() => {
    const app = () => window.IdeaApp;
    const $content = () => document.getElementById('appContent');

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

        let totalMonthlyBurn = 0;
        let totalMonthlyRevenue = 0;
        let totalActiveTasks = 0;
        let totalMeetings = 0;

        completed.forEach(i => {
            const fin = i.validations?.[0]?.agent_outputs?.['business_model']?.financial_breakdown?.cash_flow_projection;
            if (fin) {
                totalMonthlyBurn += parseFloat(String(fin.monthly_burn || '0').replace(/[^0-9.]/g, '') || 0);
                totalMonthlyRevenue += parseFloat(String(fin.monthly_inflow || '0').replace(/[^0-9.]/g, '') || 0);
            }
        });

        ideas.forEach(i => {
            totalActiveTasks += (i.tasks_total || 0) - (i.tasks_completed || 0);
            totalMeetings += (i.meetings_count || 0);
        });

        const successRate = completed.length ? ((goCount / completed.length) * 100).toFixed(0) : 0;

        return `
        <!-- Hero Command Center -->
        <div class="dash-hero" style="background:var(--primary); color:white; padding:2.5rem; border-radius:var(--radius-md); margin-bottom:2rem; position:relative; overflow:hidden;">
            <div style="position:relative; z-index:2;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                    <div>
                        <h1 style="color:white; margin:0; font-size:2rem; letter-spacing:-0.03em;">Founder OS v2.0</h1>
                        <p style="opacity:0.7; font-size:0.9rem;">Portfolio Monitoring & Macro Intelligence</p>
                    </div>
                    <button class="btn" onclick="window.IdeaApp.showNewIdeaModal()" style="background:white; color:var(--primary); border-radius:999px; padding:0.6rem 1.2rem; font-weight:700;">+ New Innovation</button>
                </div>
                
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; margin-top:1.5rem;">
                    <div style="background:rgba(255,255,255,0.1); padding:1.25rem; border-radius:var(--radius-sm); backdrop-filter:blur(10px);">
                        <div style="opacity:0.6; margin-bottom:0.5rem; font-size:0.7rem; text-transform:uppercase; font-weight:800;">Pipeline Portfolio</div>
                        <div style="font-size:1.75rem; font-weight:800;">${ideas.length} <span style="opacity:0.6; font-size:0.8rem; font-weight:400;">Assets</span></div>
                    </div>
                    <div style="background:rgba(255,255,255,0.1); padding:1.25rem; border-radius:var(--radius-sm); backdrop-filter:blur(10px);">
                        <div style="opacity:0.6; margin-bottom:0.5rem; font-size:0.7rem; text-transform:uppercase; font-weight:800;">Validation ROI</div>
                        <div style="font-size:1.75rem; font-weight:800;">${successRate}% <span style="opacity:0.6; font-size:0.8rem; font-weight:400;">GO Rate</span></div>
                    </div>
                    <div style="background:rgba(255,255,255,0.1); padding:1.25rem; border-radius:var(--radius-sm); backdrop-filter:blur(10px);">
                        <div style="opacity:0.6; margin-bottom:0.5rem; font-size:0.7rem; text-transform:uppercase; font-weight:800;">Active Tasks</div>
                        <div style="font-size:1.75rem; font-weight:800;">${totalActiveTasks} <span style="opacity:0.6; font-size:0.8rem; font-weight:400;">Pending</span></div>
                    </div>
                    <div style="background:rgba(255,255,255,0.1); padding:1.25rem; border-radius:var(--radius-sm); backdrop-filter:blur(10px);">
                        <div style="opacity:0.6; margin-bottom:0.5rem; font-size:0.7rem; text-transform:uppercase; font-weight:800;">Total Monthly Burn</div>
                        <div style="font-size:1.75rem; font-weight:800;">₹${(totalMonthlyBurn / 1000).toFixed(1)}k <span style="opacity:0.6; font-size:0.8rem; font-weight:400;">Projected</span></div>
                    </div>
                    <div style="background:rgba(255,255,255,0.1); padding:1.25rem; border-radius:var(--radius-sm); backdrop-filter:blur(10px);">
                        <div style="opacity:0.6; margin-bottom:0.5rem; font-size:0.7rem; text-transform:uppercase; font-weight:800;">Meta Strategy</div>
                        <div style="font-size:1.75rem; font-weight:800;">${totalMeetings} <span style="opacity:0.6; font-size:0.8rem; font-weight:400;">Sessions</span></div>
                    </div>
                </div>
            </div>
            <div style="position:absolute; top:0; right:0; width:40%; height:100%; background:linear-gradient(45deg, transparent, rgba(255,255,255,0.05)); z-index:1;"></div>
        </div>

        <!-- Portfolio Health Strip -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="margin:0; font-weight:800;">Portfolio Health & Risk Map</h3>
            <span style="font-size:0.7rem; color:var(--text-dim); text-transform:uppercase; font-weight:700;">Horizontal Scan</span>
        </div>
        <div class="horizontal-strip" style="display:flex; gap:1rem; overflow-x:auto; padding-bottom:1rem; margin-bottom:2rem;">
            ${completed.length === 0 ? '<div class="card" style="width:100%; text-align:center; color:var(--text-dim); padding:2rem;">No validated ideas to map</div>' : completed.map(i => `
                <div class="card" style="min-width:280px; flex-shrink:0; cursor:pointer;" onclick="location.hash='#/idea/${i.id}'">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                        <span style="font-weight:700; font-size:0.875rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">${esc(i.title)}</span>
                        <span class="badge ${i.latest_decision === 'GO' ? 'badge-go' : i.latest_decision === 'IMPROVE' ? 'badge-improve' : 'badge-kill'}">${i.latest_decision}</span>
                    </div>
                    <div style="margin-top:0.75rem;">
                        <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-dim); margin-bottom:0.25rem;">
                            <span>Risk Level</span>
                            <span style="font-weight:700;">${(10 - (i.latest_score || 0)).toFixed(1)}</span>
                        </div>
                        <div style="height:4px; background:var(--border-light); border-radius:999px; overflow:hidden;">
                            <div style="height:100%; width:${(10 - (i.latest_score || 0)) * 10}%; border-radius:999px; background:var(--${i.latest_score > 7 ? 'go' : i.latest_score > 4 ? 'improve' : 'kill'});"></div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>

        <!-- Economics Section -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="margin:0; font-weight:800;">Ecosystem Economics</h3>
            <span style="font-size:0.7rem; color:var(--text-dim); text-transform:uppercase; font-weight:700;">Fiscal Strips</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:2rem;">
            <div class="card" style="display:flex; align-items:center; gap:1.5rem; padding:1.5rem;">
                <div style="width:48px; height:48px; border-radius:12px; background:var(--go-bg); display:flex; align-items:center; justify-content:center; color:var(--go);">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <div>
                    <div style="font-size:0.7rem; color:var(--text-dim); text-transform:uppercase; font-weight:700;">Total Monthly Inflow</div>
                    <div style="font-size:1.5rem; font-weight:800;">₹${totalMonthlyRevenue.toLocaleString('en-IN')}</div>
                </div>
            </div>
            <div class="card" style="display:flex; align-items:center; gap:1.5rem; padding:1.5rem;">
                <div style="width:48px; height:48px; border-radius:12px; background:var(--kill-bg); display:flex; align-items:center; justify-content:center; color:var(--kill);">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M2 12h20"/><path d="m13 18 6-6-6-6"/></svg>
                </div>
                <div>
                    <div style="font-size:0.7rem; color:var(--text-dim); text-transform:uppercase; font-weight:700;">Combined Burn Rate</div>
                    <div style="font-size:1.5rem; font-weight:800;">₹${totalMonthlyBurn.toLocaleString('en-IN')}</div>
                </div>
            </div>
        </div>

        <!-- Innovation Assets -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="margin:0; font-weight:800;">Innovation Assets</h3>
            <div style="position:relative;">
                <input type="text" id="dashSearch" placeholder="Filter portfolio..." style="font-size:0.75rem; padding:0.4rem 1rem; border:1px solid var(--border); border-radius:999px; outline:none;">
            </div>
        </div>
        <div class="ideas-grid" id="ideasGrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:1rem;">
            ${ideas.length === 0 ? emptyState() : ideas.map(i => ideaCard(i)).join('')}
        </div>
        `;
    }

    function emptyState() {
        return `
        <div class="card" style="grid-column:1/-1; text-align:center; padding:4rem 2rem;">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--primary-light)" stroke-width="1.5" style="margin:0 auto 1rem;">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            <h2 style="font-weight:700; margin-bottom:0.5rem;">No ideas yet</h2>
            <p class="text-dim text-sm" style="max-width:360px; margin:0 auto 1.25rem;">Start by creating your first startup idea to validate it with our multi-agent AI system.</p>
            <button class="btn btn-primary" onclick="window.IdeaApp.showNewIdeaModal()">Create First Idea</button>
        </div>`;
    }

    function ideaCard(idea) {
        const score = idea.latest_score;
        const decision = idea.latest_decision;
        const date = idea.updated_at ? new Date(idea.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        const scoreColor = decision === 'GO' ? 'var(--go)' : decision === 'IMPROVE' ? 'var(--improve)' : decision === 'KILL' ? 'var(--kill)' : 'var(--text-dim)';

        return `
        <div class="card idea-card" data-title="${esc(idea.title)}" onclick="location.hash='#/idea/${idea.id}'" style="cursor:pointer; transition:all 0.2s ease; position:relative; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                <div style="font-weight:700; font-size:1rem; line-height:1.3; flex:1; margin-right:0.5rem;">${esc(idea.title)}</div>
                ${decision ? `<span class="badge ${decision === 'GO' ? 'badge-go' : decision === 'IMPROVE' ? 'badge-improve' : 'badge-kill'}">${decision}</span>` : `<span class="badge badge-draft">Draft</span>`}
            </div>
            <p class="text-dim text-sm" style="margin-bottom:1rem; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${esc(idea.description || '')}</p>
            
            ${score != null ? `
            <div style="margin-bottom:0.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                    <span class="text-xs text-dim">Validation Score</span>
                    <span style="font-weight:800; color:${scoreColor}; font-size:1.1rem;">${score.toFixed(1)}</span>
                </div>
                <div style="height:6px; background:var(--bg-panel); border-radius:999px; overflow:hidden;">
                    <div style="height:100%; width:${score * 10}%; background:${scoreColor}; border-radius:999px; transition:width 0.5s ease;"></div>
                </div>
            </div>
            ` : ''}

            <div style="display:flex; gap:0.5rem; margin-top:0.75rem; margin-bottom:0.5rem;">
                <div style="flex:1; background:var(--bg-main); padding:0.4rem; border-radius:6px; text-align:center;">
                    <div class="text-xs text-dim" style="margin-bottom:0.15rem;">Tasks</div>
                    <div style="font-weight:700; font-size:0.85rem;">${idea.tasks_completed || 0}/${idea.tasks_total || 0}</div>
                </div>
                <div style="flex:1; background:var(--bg-main); padding:0.4rem; border-radius:6px; text-align:center;">
                    <div class="text-xs text-dim" style="margin-bottom:0.15rem;">Tests</div>
                    <div style="font-weight:700; font-size:0.85rem;">${idea.experiments_total || 0}</div>
                </div>
            </div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.75rem;">
                <span class="text-xs text-dim">${date}</span>
                <span class="text-xs" style="color:var(--primary); font-weight:600;">${idea.status === 'validating' ? '⏳ Validating…' : idea.validation_count > 0 ? `${idea.validation_count} iterations` : 'Draft'}</span>
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
    }

    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    return { render };
})();
