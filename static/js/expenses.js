/**
 * expenses.js — Expenses tracker module for idea workspace
 */
window.Expenses = (() => {
    let currentIdeaId = null;
    let containerId = null;

    async function init(ideaId, target) {
        currentIdeaId = ideaId;
        containerId = target;
        await render();
    }

    async function render() {
        const c = document.getElementById(containerId);
        if (!c) return;
        c.innerHTML = '<div style="text-align:center;padding:2rem"><div class="spinner" style="margin:0 auto"></div></div>';

        try {
            const res = await fetch(`/api/ideas/${currentIdeaId}/expenses`);
            const expenses = await res.json();
            c.innerHTML = buildUI(expenses);
        } catch (err) {
            c.innerHTML = `<div class="card" style="color:var(--kill)">Failed to load expenses</div>`;
        }
    }

    function buildUI(expenses) {
        const esc = window.IdeaApp.esc;
        const fmt = (v) => `\u20b9${(v || 0).toLocaleString('en-IN')}`;
        const totalEst = expenses.reduce((s, e) => s + (e.estimated_cost || 0), 0);
        const totalAct = expenses.reduce((s, e) => s + (e.actual_cost || 0), 0);

        const rows = expenses.map(e => `
            <tr>
                <td style="padding:0.5rem 0.75rem;">${esc(e.title)}</td>
                <td style="padding:0.5rem 0.75rem;" class="text-dim">${esc(e.category || '-')}</td>
                <td style="padding:0.5rem 0.75rem; text-align:right;">${fmt(e.estimated_cost)}</td>
                <td style="padding:0.5rem 0.75rem; text-align:right; font-weight:600;">${fmt(e.actual_cost)}</td>
                <td style="padding:0.5rem 0.75rem;"><span class="badge badge-${e.status === 'spent' ? 'kill' : 'go'}" style="font-size:0.7rem; padding:2px 8px; border-radius:4px;">${esc(e.status)}</span></td>
                <td style="padding:0.5rem 0.75rem;" class="text-dim text-sm">${e.date ? new Date(e.date).toLocaleDateString() : '-'}</td>
                <td style="padding:0.5rem 0.75rem;"><button onclick="window.Expenses.remove(${e.id})" class="btn btn-outline text-sm" style="padding:1px 6px; color:var(--kill);">&times;</button></td>
            </tr>
        `).join('');

        return `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h2 style="font-size:1.25rem; font-weight:800; margin:0;">Expenses</h2>
                <button class="btn btn-primary text-sm" onclick="window.Expenses.showForm()">+ New Expense</button>
            </div>
            <div id="expense-form-area" style="display:none; margin-bottom:1rem;"></div>

            <!-- Summary -->
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:1rem; margin-bottom:1rem;">
                <div class="card" style="text-align:center; padding:1rem;"><div class="text-dim text-sm">Estimated Total</div><div style="font-size:1.25rem; font-weight:700;">${fmt(totalEst)}</div></div>
                <div class="card" style="text-align:center; padding:1rem;"><div class="text-dim text-sm">Actual Spent</div><div style="font-size:1.25rem; font-weight:700; color:var(--kill);">${fmt(totalAct)}</div></div>
                <div class="card" style="text-align:center; padding:1rem;"><div class="text-dim text-sm">Variance</div><div style="font-size:1.25rem; font-weight:700; color:${totalAct > totalEst ? 'var(--kill)' : 'var(--go)'};">${fmt(totalEst - totalAct)}</div></div>
            </div>

            ${expenses.length ? `
            <div class="card" style="overflow-x:auto; padding:0;">
                <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                    <thead><tr style="border-bottom:1px solid var(--border-light); background:var(--bg-card);">
                        <th style="padding:0.5rem 0.75rem; text-align:left;">Title</th>
                        <th style="padding:0.5rem 0.75rem; text-align:left;">Category</th>
                        <th style="padding:0.5rem 0.75rem; text-align:right;">Estimated</th>
                        <th style="padding:0.5rem 0.75rem; text-align:right;">Actual</th>
                        <th style="padding:0.5rem 0.75rem; text-align:left;">Status</th>
                        <th style="padding:0.5rem 0.75rem; text-align:left;">Date</th>
                        <th style="padding:0.5rem 0.75rem;"></th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                    <tfoot><tr style="border-top:2px solid var(--border-light); font-weight:700;">
                        <td style="padding:0.5rem 0.75rem;" colspan="2">Total</td>
                        <td style="padding:0.5rem 0.75rem; text-align:right;">${fmt(totalEst)}</td>
                        <td style="padding:0.5rem 0.75rem; text-align:right;">${fmt(totalAct)}</td>
                        <td colspan="3"></td>
                    </tr></tfoot>
                </table>
            </div>`
                : '<div class="card" style="text-align:center; padding:2rem;"><p class="text-dim">No expenses yet. Click "+ New Expense" to start tracking.</p></div>'}
        `;
    }

    function showForm() {
        const area = document.getElementById('expense-form-area');
        if (!area) return;
        area.style.display = 'block';
        area.innerHTML = `
            <div class="card" style="padding:1rem;">
                <h4 style="margin-top:0;">New Expense</h4>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.75rem;">
                    <div>
                        <label class="text-sm fw-600">Title *</label>
                        <input type="text" id="exp-title" class="form-control" placeholder="Expense title">
                    </div>
                    <div>
                        <label class="text-sm fw-600">Category</label>
                        <select id="exp-category" class="form-control">
                            <option value="">Select...</option>
                            <option>Infrastructure</option>
                            <option>Marketing</option>
                            <option>Salaries</option>
                            <option>Legal</option>
                            <option>Software</option>
                            <option>Travel</option>
                            <option>Other</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-sm fw-600">Date</label>
                        <input type="date" id="exp-date" class="form-control">
                    </div>
                    <div>
                        <label class="text-sm fw-600">Estimated Cost (\u20b9)</label>
                        <input type="number" id="exp-estimated" class="form-control" value="0">
                    </div>
                    <div>
                        <label class="text-sm fw-600">Actual Cost (\u20b9)</label>
                        <input type="number" id="exp-actual" class="form-control" value="0">
                    </div>
                    <div>
                        <label class="text-sm fw-600">Status</label>
                        <select id="exp-status" class="form-control">
                            <option value="planned">Planned</option>
                            <option value="spent">Spent</option>
                        </select>
                    </div>
                </div>
                <div style="margin-top:0.75rem;">
                    <label class="text-sm fw-600">Notes</label>
                    <input type="text" id="exp-notes" class="form-control" placeholder="Optional notes">
                </div>
                <div style="display:flex; gap:0.5rem; margin-top:0.75rem;">
                    <button class="btn btn-primary text-sm" onclick="window.Expenses.save()">Save</button>
                    <button class="btn btn-outline text-sm" onclick="document.getElementById('expense-form-area').style.display='none'">Cancel</button>
                </div>
            </div>
        `;
    }

    async function save() {
        const title = document.getElementById('exp-title')?.value?.trim();
        if (!title) return alert('Title is required');
        const data = {
            title,
            category: document.getElementById('exp-category')?.value || null,
            estimated_cost: parseFloat(document.getElementById('exp-estimated')?.value) || 0,
            actual_cost: parseFloat(document.getElementById('exp-actual')?.value) || 0,
            status: document.getElementById('exp-status')?.value || 'planned',
            date: document.getElementById('exp-date')?.value || null,
            notes: document.getElementById('exp-notes')?.value?.trim() || null,
        };
        try {
            await fetch(`/api/ideas/${currentIdeaId}/expenses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            await render();
        } catch (err) {
            alert('Failed to save expense');
        }
    }

    async function remove(id) {
        if (!confirm('Delete this expense?')) return;
        await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
        await render();
    }

    return { init, showForm, save, remove };
})();
