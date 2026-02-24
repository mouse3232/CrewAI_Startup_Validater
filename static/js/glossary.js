/**
 * Glossary.js — Methodology & Glossary page
 * Renders metric definitions, formula explanations, assumptions.
 */

window.Glossary = (() => {
    const $content = () => document.getElementById('appContent');

    async function render() {
        const el = $content();
        el.innerHTML = '<div style="text-align:center;padding:4rem"><div class="spinner" style="margin:0 auto"></div></div>';

        let data;
        try {
            const res = await fetch('/api/methodology');
            data = await res.json();
        } catch (err) {
            el.innerHTML = `<div class="card" style="text-align:center;padding:3rem"><h2>Error</h2><p class="text-dim">${esc(err.message)}</p></div>`;
            return;
        }

        el.innerHTML = buildPage(data);
    }

    function buildPage(data) {
        return `
        <div style="margin-bottom:1.5rem">
            <a href="#/" class="text-dim" style="text-decoration:none;font-size:0.85rem">← Back to Dashboard</a>
            <h1 style="font-size:1.75rem;font-weight:800;letter-spacing:-0.02em;margin:0.5rem 0 0.25rem">Methodology & Glossary</h1>
            <p class="text-dim" style="font-size:0.95rem;max-width:700px">Complete transparency on how all validation metrics are calculated, what they mean strategically, and the assumptions behind the system.</p>
        </div>

        <!-- Metric Definitions -->
        <h2 style="font-size:1.25rem;font-weight:700;margin:2rem 0 1rem">Metric Definitions</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:1rem">
            ${data.metric_definitions.map(m => metricCard(m)).join('')}
        </div>

        <!-- Formula Explanations -->
        <h2 style="font-size:1.25rem;font-weight:700;margin:2.5rem 0 1rem">Formula Explanations</h2>
        <div style="display:flex;flex-direction:column;gap:1rem">
            ${Object.values(data.formula_explanations).map(f => formulaCard(f)).join('')}
        </div>

        <!-- Assumptions & Limitations -->
        <h2 style="font-size:1.25rem;font-weight:700;margin:2.5rem 0 1rem">Assumptions & Limitations</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1rem;margin-bottom:3rem">
            ${assumptionCard('Model-Based Assumptions', data.assumptions_and_limitations.model_assumptions, '#3b82f6')}
            ${assumptionCard('Estimation Boundaries', data.assumptions_and_limitations.estimation_boundaries, '#f59e0b')}
            ${assumptionCard('Non-Deterministic Areas', data.assumptions_and_limitations.non_deterministic_areas, '#ef4444')}
        </div>
        `;
    }

    function metricCard(m) {
        return `
        <div class="card" style="padding:1.25rem">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem">
                <h3 style="font-size:1rem;font-weight:700;margin:0">${esc(m.name)}</h3>
                <span style="font-size:0.7rem;padding:0.2rem 0.6rem;border-radius:999px;background:var(--bg-alt);color:var(--text-dim);white-space:nowrap">${esc(m.scale)}</span>
            </div>
            <div class="text-xs text-dim" style="margin-bottom:0.75rem">Agent: ${esc(m.agent)}</div>
            <div style="font-size:0.85rem;margin-bottom:0.75rem">
                <strong style="color:var(--primary);font-size:0.75rem;text-transform:uppercase;letter-spacing:0.03em">What it measures</strong>
                <p style="margin:0.25rem 0 0;color:var(--text)">${esc(m.measures)}</p>
            </div>
            <div style="font-size:0.85rem;margin-bottom:0.75rem">
                <strong style="color:var(--primary);font-size:0.75rem;text-transform:uppercase;letter-spacing:0.03em">How it's calculated</strong>
                <p style="margin:0.25rem 0 0;color:var(--text)">${esc(m.calculation)}</p>
            </div>
            <div style="font-size:0.85rem;padding-top:0.5rem;border-top:1px dashed var(--border-light)">
                <strong style="color:var(--improve);font-size:0.75rem;text-transform:uppercase;letter-spacing:0.03em">Strategic meaning</strong>
                <p style="margin:0.25rem 0 0;color:var(--text-dim);font-style:italic">${esc(m.strategic_meaning)}</p>
            </div>
        </div>`;
    }

    function formulaCard(f) {
        const formula = f.formula || '';
        const weights = f.weights ? Object.entries(f.weights).map(([k, v]) => `<span style="display:inline-block;padding:0.2rem 0.6rem;margin:0.2rem;border-radius:999px;background:var(--bg-alt);font-size:0.78rem"><strong>${esc(k)}</strong>: ${esc(v)}</span>`).join('') : '';
        const components = f.components ? Object.entries(f.components).map(([k, v]) => `<div style="margin-bottom:0.35rem"><code style="background:var(--bg-alt);padding:0.1rem 0.4rem;border-radius:4px;font-size:0.8rem">${esc(k)}</code> — <span class="text-dim" style="font-size:0.82rem">${esc(v)}</span></div>`).join('') : '';
        const thresholds = f.thresholds ? Object.entries(f.thresholds).map(([k, v]) => {
            const color = k === 'GO' ? 'var(--go)' : k === 'IMPROVE' ? 'var(--improve)' : 'var(--kill)';
            return `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.35rem"><span class="decision-badge" style="background:${color};color:#fff;font-size:0.7rem">${esc(k)}</span><span style="font-size:0.82rem">${esc(v)}</span></div>`;
        }).join('') : '';

        return `
        <div class="card" style="padding:1.25rem">
            <h3 style="font-size:1rem;font-weight:700;margin-bottom:0.5rem">${esc(f.name)}</h3>
            ${formula ? `<div style="background:var(--bg-alt);padding:0.75rem 1rem;border-radius:var(--radius-sm);font-family:monospace;font-size:0.85rem;margin-bottom:0.75rem;border-left:3px solid var(--primary)">${esc(formula)}</div>` : ''}
            ${f.method ? `<div style="background:var(--bg-alt);padding:0.75rem 1rem;border-radius:var(--radius-sm);font-size:0.85rem;margin-bottom:0.75rem;border-left:3px solid var(--info)">${esc(f.method)}</div>` : ''}
            ${weights ? `<div style="margin-bottom:0.75rem">${weights}</div>` : ''}
            ${components ? `<div style="margin-bottom:0.75rem">${components}</div>` : ''}
            ${thresholds ? `<div style="margin-bottom:0.75rem">${thresholds}</div>` : ''}
            <p class="text-dim" style="font-size:0.85rem;margin:0">${esc(f.explanation)}</p>
        </div>`;
    }

    function assumptionCard(title, items, color) {
        return `
        <div class="card" style="padding:1.25rem;border-top:3px solid ${color}">
            <h3 style="font-size:1rem;font-weight:700;margin-bottom:0.75rem">${esc(title)}</h3>
            <ul style="list-style:none;padding:0;margin:0">
                ${items.map(item => `<li style="font-size:0.85rem;padding:0.4rem 0;border-bottom:1px solid var(--border-light);color:var(--text-dim)">• ${esc(item)}</li>`).join('')}
            </ul>
        </div>`;
    }

    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    return { render };
})();
