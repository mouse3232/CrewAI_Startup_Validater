/**
 * meetings.js — Meetings module for idea workspace
 */
window.Meetings = (() => {
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
            const res = await fetch(`/api/ideas/${currentIdeaId}/meetings`);
            const meetings = await res.json();
            c.innerHTML = buildUI(meetings);
        } catch (err) {
            c.innerHTML = `<div class="card" style="color:var(--kill)">Failed to load meetings</div>`;
        }
    }

    function buildUI(meetings) {
        const esc = window.IdeaApp.esc;
        const rows = meetings.map(m => `
            <div class="card" style="margin-bottom:0.75rem; padding:1rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                    <h4 style="margin:0; font-size:1rem;">${esc(m.title)}</h4>
                    <div style="display:flex; gap:0.5rem; align-items:center;">
                        <span class="text-dim text-sm">${m.date ? new Date(m.date).toLocaleDateString() : 'No date'}</span>
                        <button onclick="window.Meetings.remove(${m.id})" class="btn btn-outline text-sm" style="padding:2px 8px; color:var(--kill);">&times;</button>
                    </div>
                </div>
                ${m.participants.length ? `<div class="text-sm" style="margin-bottom:0.4rem"><strong>Participants:</strong> ${m.participants.map(p => esc(p)).join(', ')}</div>` : ''}
                ${m.notes ? `<div class="text-sm text-dim" style="margin-bottom:0.4rem">${esc(m.notes)}</div>` : ''}
                ${m.decisions ? `<div class="text-sm" style="margin-bottom:0.4rem"><strong>Decisions:</strong> ${esc(m.decisions)}</div>` : ''}
                ${m.tasks_assigned && m.tasks_assigned.length ? `<div class="text-sm"><strong>Tasks:</strong> ${m.tasks_assigned.map(t => esc(t.title || t)).join(', ')}</div>` : ''}
            </div>
        `).join('');

        return `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h2 style="font-size:1.25rem; font-weight:800; margin:0;">Meetings</h2>
                <button class="btn btn-primary text-sm" onclick="window.Meetings.showForm()">+ New Meeting</button>
            </div>
            <div id="meeting-form-area" style="display:none; margin-bottom:1rem;"></div>
            ${meetings.length ? rows : '<div class="card" style="text-align:center; padding:2rem;"><p class="text-dim">No meetings yet. Click "+ New Meeting" to add one.</p></div>'}
        `;
    }

    function showForm() {
        const area = document.getElementById('meeting-form-area');
        if (!area) return;
        area.style.display = 'block';
        area.innerHTML = `
            <div class="card" style="padding:1rem;">
                <h4 style="margin-top:0;">New Meeting</h4>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                    <div>
                        <label class="text-sm fw-600">Title *</label>
                        <input type="text" id="mtg-title" class="form-control" placeholder="Meeting title">
                    </div>
                    <div>
                        <label class="text-sm fw-600">Date</label>
                        <input type="date" id="mtg-date" class="form-control">
                    </div>
                    <div>
                        <label class="text-sm fw-600">Participants (comma-separated)</label>
                        <input type="text" id="mtg-participants" class="form-control" placeholder="Alice, Bob">
                    </div>
                    <div>
                        <label class="text-sm fw-600">Decisions</label>
                        <input type="text" id="mtg-decisions" class="form-control" placeholder="Key decisions taken">
                    </div>
                </div>
                <div style="margin-top:0.75rem;">
                    <label class="text-sm fw-600">Notes</label>
                    <textarea id="mtg-notes" class="form-control" rows="3" placeholder="Meeting notes..."></textarea>
                </div>
                <div style="display:flex; gap:0.5rem; margin-top:0.75rem;">
                    <button class="btn btn-primary text-sm" onclick="window.Meetings.save()">Save</button>
                    <button class="btn btn-outline text-sm" onclick="document.getElementById('meeting-form-area').style.display='none'">Cancel</button>
                </div>
            </div>
        `;
    }

    async function save() {
        const title = document.getElementById('mtg-title')?.value?.trim();
        if (!title) return alert('Title is required');
        const date = document.getElementById('mtg-date')?.value;
        const participants = (document.getElementById('mtg-participants')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
        const notes = document.getElementById('mtg-notes')?.value?.trim();
        const decisions = document.getElementById('mtg-decisions')?.value?.trim();

        try {
            await fetch(`/api/ideas/${currentIdeaId}/meetings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, date: date || null, participants, notes, decisions })
            });
            await render();
        } catch (err) {
            alert('Failed to save meeting');
        }
    }

    async function remove(id) {
        if (!confirm('Delete this meeting?')) return;
        await fetch(`/api/meetings/${id}`, { method: 'DELETE' });
        await render();
    }

    return { init, showForm, save, remove };
})();
