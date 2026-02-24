/**
 * js/journal.js
 * Daily Execution Notes & Logging
 */

window.Journal = (() => {
    const app = () => window.IdeaApp;
    let currentIdeaId = null;

    async function init(ideaId, containerId) {
        currentIdeaId = ideaId;
        const container = document.getElementById(containerId);
        container.innerHTML = '<div style="text-align:center;padding:2rem"><div class="spinner" style="margin:0 auto"></div></div>';

        try {
            const entries = await app().apiFetch(`/ideas/${ideaId}/journal`);
            renderJournal(entries, container);
        } catch (err) {
            container.innerHTML = `<div class="card" style="text-align:center;color:var(--kill)">Failed to load journal: ${app().esc(err.message)}</div>`;
        }
    }

    function renderJournal(entries, container) {
        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
                <div>
                    <h2 style="font-size:1.25rem; font-weight:800; margin:0">Execution Journal</h2>
                    <p class="text-dim text-sm" style="margin-top:0.25rem">Log daily experiments, market feedback, and pivot decisions.</p>
                </div>
                <button class="btn btn-primary" onclick="window.Journal.showNewEntryModal()">+ New Entry</button>
            </div>
            
            <div class="journal-timeline" style="display:flex; flex-direction:column; gap:1.5rem; position:relative">
                <div style="position:absolute; left:20px; top:0; bottom:0; width:2px; background:var(--border-light); z-index:0"></div>
                ${entries.length === 0 ? emptyState() : entries.map(e => journalEntryNode(e)).join('')}
            </div>
        `;
    }

    function emptyState() {
        return `
            <div class="card" style="text-align:center; padding:3rem; z-index:1; position:relative; margin-left:40px">
                <div style="font-size:2rem; margin-bottom:1rem">📓</div>
                <h3 style="margin-bottom:0.5rem">Journal is empty</h3>
                <p class="text-dim text-sm">Start logging your execution journey and market learnings here.</p>
            </div>
        `;
    }

    function journalEntryNode(entry) {
        const date = new Date(entry.created_at);
        const tagsHtml = (entry.tags || []).map(t => `<span style="font-size:0.65rem; padding:0.2rem 0.5rem; background:var(--bg-alt); color:var(--text-dim); border-radius:4px; font-weight:600">#${app().esc(t)}</span>`).join('');

        return `
            <div style="display:flex; gap:1.5rem; position:relative; z-index:1">
                <div style="width:40px; height:40px; border-radius:50%; background:var(--bg); border:2px solid var(--primary-light); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-weight:700; font-size:0.8rem; color:var(--primary)">
                    ${date.getDate()}
                </div>
                <div class="card journal-card" style="flex:1; padding:1.25rem">
                    <div style="font-size:0.75rem; color:var(--text-dim); margin-bottom:0.75rem; font-weight:600">
                        ${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div style="font-size:0.95rem; line-height:1.6; white-space:pre-wrap; margin-bottom:${entry.tags?.length ? '1rem' : '0'}">${app().esc(entry.content)}</div>
                    ${tagsHtml ? `<div style="display:flex; gap:0.5rem; flex-wrap:wrap">${tagsHtml}</div>` : ''}
                </div>
            </div>
        `;
    }

    function showNewEntryModal() {
        app().toast('Journal entry modal coming soon!', 'info');
    }

    return { init, showNewEntryModal };
})();
