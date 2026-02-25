/**
 * js/tasks.js
 * Task Management Module for execution tracking.
 */

window.Tasks = (() => {
    const app = () => window.IdeaApp;
    let currentIdeaId = null;

    async function init(ideaId, containerId) {
        currentIdeaId = ideaId;
        const container = document.getElementById(containerId);
        container.innerHTML = '<div style="text-align:center;padding:2rem"><div class="spinner" style="margin:0 auto"></div></div>';

        try {
            const tasks = await app().apiFetch(`/ideas/${ideaId}/tasks`);
            renderTasks(tasks, container);
        } catch (err) {
            container.innerHTML = `<div class="card" style="text-align:center;color:var(--kill)">Failed to load tasks: ${app().esc(err.message)}</div>`;
        }
    }

    function renderTasks(tasks, container) {
        const cols = [
            { id: 'planned', label: 'Planned', border: 'var(--text-dim)' },
            { id: 'in_progress', label: 'In Progress', border: 'var(--info)' },
            { id: 'testing', label: 'Testing', border: 'var(--improve)' },
            { id: 'blocked', label: 'Blocked', border: 'var(--kill)' },
            { id: 'completed', label: 'Done', border: 'var(--go)' }
        ];

        const grouped = {};
        cols.forEach(c => grouped[c.id] = []);
        tasks.forEach(t => {
            if (grouped[t.status]) grouped[t.status].push(t);
            else grouped['planned'].push(t); // fallback
        });

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
                <div>
                    <h2 style="font-size:1.25rem; font-weight:800; margin:0">Kanban Execution Board</h2>
                    <p class="text-dim text-sm" style="margin-top:0.25rem">Drag and drop tasks to update progress. Convert insights into action.</p>
                </div>
                <button class="btn btn-primary" onclick="window.Tasks.showNewTaskModal()">+ Add Task</button>
            </div>
            
            <div class="kanban-board" style="display:flex; gap: 1rem; overflow-x: auto; padding-bottom: 1rem; align-items: flex-start; min-height: 400px;">
        `;

        cols.forEach(col => {
            const colTasks = grouped[col.id];
            html += `
                <div class="kanban-column" style="flex: 1; min-width: 250px; background: var(--bg); border: 1px solid var(--border-light); border-radius: 8px; display: flex; flex-direction: column;">
                    <div style="padding: 0.75rem 1rem; border-bottom: 3px solid ${col.border}; background: rgba(0,0,0,0.02); font-weight: 700; border-radius: 8px 8px 0 0; display:flex; justify-content:space-between;">
                        ${col.label}
                        <span style="background: var(--border); color: var(--text-dim); padding: 0.1rem 0.5rem; border-radius: 99px; font-size: 0.75rem;">${colTasks.length}</span>
                    </div>
                    <div class="kanban-dropzone" data-status="${col.id}" style="padding: 0.5rem; flex: 1; min-height: 100px;">
                        ${colTasks.map(t => taskCard(t)).join('')}
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;

        // Setup SortableJS for each column if available
        if (window.Sortable) {
            document.querySelectorAll('.kanban-dropzone').forEach(zone => {
                new Sortable(zone, {
                    group: 'kanban',
                    animation: 150,
                    ghostClass: 'sortable-ghost',
                    onEnd: async (evt) => {
                        const taskId = evt.item.dataset.id;
                        const newStatus = evt.to.dataset.status;
                        if (evt.from !== evt.to) {
                            try {
                                await app().apiFetch(`/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
                                app().toast('Task updated', 'success');
                                // Refresh count badges (simple reload for now)
                                init(currentIdeaId, container.id);
                            } catch (e) {
                                app().toast(e.message, 'error');
                                init(currentIdeaId, container.id); // revert
                            }
                        }
                    }
                });
            });
        }
    }

    function taskCard(task) {
        const priorityColors = { low: 'var(--text-dim)', medium: 'var(--info)', high: 'var(--improve)', urgent: 'var(--kill)' };

        return `
            <div class="card task-card" data-id="${task.id}" style="padding: 0.75rem; margin-bottom: 0.5rem; cursor: grab; background: var(--card-bg); box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 0.5rem;">
                    <h4 style="font-weight:600; font-size: 0.9rem; margin:0; line-height: 1.3;">${app().esc(task.title)}</h4>
                </div>
                ${task.description ? `<p class="text-xs text-dim" style="margin:0 0 0.5rem 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${app().esc(task.description)}</p>` : ''}
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.7rem; margin-top: auto;">
                    <span style="padding:0.15rem 0.4rem; border-radius:4px; background:${priorityColors[task.priority]}15; color:${priorityColors[task.priority]}; font-weight:700; text-transform:uppercase">${app().esc(task.priority)}</span>
                    ${task.deadline ? `<span class="text-dim">⏰ ${new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>` : ''}
                </div>
            </div>
        `;
    }

    function showNewTaskModal() {
        app().toast('Task creation modal coming soon!', 'info');
    }

    return { init, showNewTaskModal };
})();
