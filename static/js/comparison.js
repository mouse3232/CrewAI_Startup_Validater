/**
 * Comparison.js — Side-by-side idea comparison with overlaid radar
 */

window.Comparison = (() => {
    const app = () => window.IdeaApp;
    const $content = () => document.getElementById('appContent');
    let compChart = null;

    async function render() {
        const el = $content();
        el.innerHTML = '<div style="text-align:center;padding:4rem"><div class="spinner" style="margin:0 auto"></div></div>';

        let ideas;
        try {
            ideas = await app().api.listIdeas();
        } catch (err) {
            el.innerHTML = `<div class="card" style="text-align:center; padding: 4rem;"><h2>Error</h2><p class="text-dim">${err.message}</p></div>`;
            return;
        }

        const completed = ideas.filter(i => i.status === 'completed');
        if (completed.length < 2) {
            el.innerHTML = `
                <div class="card" style="text-align:center; padding: 4rem 2rem;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary-light)" stroke-width="2" style="margin-bottom:1rem">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                    <h2 class="mb-1">Need More Ideas</h2>
                    <p class="text-dim text-sm mb-2" style="max-width:400px; margin: 0 auto 1.5rem auto;">Validate at least 2 ideas to use the side-by-side comparison view.</p>
                    <a href="#/" class="btn btn-outline">Back to Dashboard</a>
                </div>
            `;
            return;
        }

        el.innerHTML = `
            <div class="compare-header flex" style="justify-content:space-between; align-items:flex-end; margin-bottom: 2rem;">
                <div>
                    <h1 style="font-size:1.75rem;font-weight:800;letter-spacing:-0.02em;">Compare Ideas</h1>
                    <p class="text-dim text-sm" style="margin-top:0.25rem;">Select 2 or more ideas to compare their validation results side by side.</p>
                </div>
                <button class="btn btn-primary btn-sm" onclick="window.Comparison.loadComparison()">Compare Selected</button>
            </div>
            
            <div class="compare-selector" id="compareSelector" style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-bottom: 2rem;">
                ${completed.map(i => `
                    <label class="btn btn-outline compare-chip" data-id="${i.id}" style="cursor:pointer; padding: 0.4rem 1rem; border-radius:999px;">
                        <input type="checkbox" value="${i.id}" onchange="window.Comparison.onSelect()" style="display:none">
                        ${esc(i.title)}
                        <span style="margin-left:0.5rem">${app().decisionBadge(i.latest_decision)}</span>
                    </label>
                `).join('')}
            </div>
            
            <div id="comparisonResults"></div>
        `;
    }

    function onSelect() {
        document.querySelectorAll('.compare-chip').forEach(chip => {
            const cb = chip.querySelector('input');
            if (cb.checked) {
                chip.style.borderColor = 'var(--primary)';
                chip.style.backgroundColor = 'var(--primary-light)';
                chip.style.color = 'var(--primary)';
            } else {
                chip.style.borderColor = 'var(--border)';
                chip.style.backgroundColor = 'transparent';
                chip.style.color = 'var(--text-main)';
            }
        });
    }

    async function loadComparison() {
        const selected = [];
        document.querySelectorAll('.compare-chip input:checked').forEach(cb => {
            selected.push(parseInt(cb.value));
        });

        if (selected.length < 2) {
            app().toast('Select at least 2 ideas', 'info');
            return;
        }

        const results = document.getElementById('comparisonResults');
        results.innerHTML = '<div style="text-align:center;padding:2rem"><div class="spinner" style="margin:0 auto"></div></div>';

        try {
            const data = await app().api.compare(selected);
            results.innerHTML = renderComparison(data);
            renderComparisonChart(data);
        } catch (err) {
            results.innerHTML = `<p class="text-dim">Error: ${err.message}</p>`;
        }
    }

    function renderComparison(items) {
        const COLORS = ['#0f172a', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

        // Score delta table
        let tableRows = '';
        if (items.length >= 2 && items[0].validation && items[1].validation) {
            const dims0 = getDims(items[0].validation);
            const dims1 = getDims(items[1].validation);
            const allKeys = [...new Set([...Object.keys(dims0), ...Object.keys(dims1)])];
            tableRows = allKeys.map(k => {
                const v0 = dims0[k] || 0;
                const v1 = dims1[k] || 0;
                const delta = (v1 - v0).toFixed(2);
                const cls = delta > 0 ? 'var(--go)' : delta < 0 ? 'var(--kill)' : 'var(--text-muted)';
                return `
                    <tr style="border-bottom: 1px solid var(--border-light)">
                        <td style="padding:0.75rem 0.5rem; font-weight:500;">${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
                        <td style="padding:0.75rem; text-align:center">${v0.toFixed(1)}</td>
                        <td style="padding:0.75rem; text-align:center">${v1.toFixed(1)}</td>
                        <td style="padding:0.75rem; text-align:center; color:${cls}; font-weight:700">${delta > 0 ? '+' : ''}${delta}</td>
                    </tr>
                `;
            }).join('');
        }

        return `
            <div class="card mt-2" style="min-height:360px">
                <h3 class="fw-700 mb-2" style="font-size:1.1rem">Overlay Comparison</h3>
                <div class="chart-wrapper"><canvas id="comparisonRadar"></canvas></div>
            </div>

            ${tableRows ? `
            <div class="card mt-3">
                <h3 class="fw-700 mb-2" style="font-size:1.1rem">Score Deltas</h3>
                <table style="width:100%;font-size:0.9rem;border-collapse:collapse">
                    <thead>
                        <tr style="color:var(--text-dim);text-align:left; border-bottom: 2px solid var(--border)">
                            <th style="padding:0.5rem">Dimension</th>
                            <th style="padding:0.5rem; text-align:center">${esc(items[0].title)}</th>
                            <th style="padding:0.5rem; text-align:center">${esc(items[1].title)}</th>
                            <th style="padding:0.5rem; text-align:center">Delta</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
            ` : ''}

            <div class="ideas-grid mt-3">
                ${items.map((item, idx) => `
                    <div class="card">
                        <div class="idea-card-header">
                            <div class="idea-card-title" style="color:${COLORS[idx]}">${esc(item.title)}</div>
                            ${app().decisionBadge(item.latest_decision)}
                        </div>
                        ${item.validation ? `
                            ${app().scoreBarHTML(item.validation.final_score, item.validation.decision)}
                            <div class="mt-2 text-sm text-dim flex" style="justify-content:space-between">
                                <span>AI Confidence: <strong style="color:var(--info)">${(item.validation.confidence_index || 0).toFixed(0)}%</strong></span>
                                <span>Iteration: <strong>#${item.validation.iteration}</strong></span>
                            </div>
                        ` : '<p class="text-dim text-sm">Not validated</p>'}
                    </div>
                `).join('')}
            </div>
        `;
    }

    function getDims(validation) {
        const sh = validation.score_history || [];
        const latest = sh[sh.length - 1] || {};
        return latest.dimensions || {};
    }

    function renderComparisonChart(items) {
        if (compChart) compChart.destroy();
        const COLORS = [
            { bg: 'rgba(15, 23, 42, 0.1)', border: '#0f172a' },
            { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6' },
            { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981' },
            { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b' },
        ];

        // Gather all dimension keys
        const allKeys = new Set();
        items.forEach(item => {
            if (item.validation) {
                Object.keys(getDims(item.validation)).forEach(k => allKeys.add(k));
            }
        });
        const labels = [...allKeys].map(k => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

        const datasets = items.map((item, idx) => {
            const dims = item.validation ? getDims(item.validation) : {};
            const color = COLORS[idx % COLORS.length];
            return {
                label: item.title,
                data: [...allKeys].map(k => dims[k] || 0),
                backgroundColor: color.bg, borderColor: color.border,
                borderWidth: 2, pointBackgroundColor: color.border, pointRadius: 4,
            };
        });

        const ctx = document.getElementById('comparisonRadar');
        if (!ctx) return;
        compChart = new Chart(ctx, {
            type: 'radar',
            data: { labels, datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    r: {
                        min: 0, max: 10,
                        ticks: { stepSize: 2, color: '#64748b', backdropColor: 'transparent' },
                        grid: { color: 'rgba(15, 23, 42, 0.08)' },
                        pointLabels: { color: '#0f172a', font: { size: 11, weight: '600' } },
                    },
                },
                plugins: {
                    legend: { labels: { color: '#0f172a', font: { size: 12, weight: '500' } }, position: 'top' },
                },
            },
        });
    }

    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    return { render, onSelect, loadComparison };
})();
