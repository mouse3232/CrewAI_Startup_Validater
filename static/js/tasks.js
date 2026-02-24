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
        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
                <div>
                    <h2 style="font-size:1.25rem; font-weight:800; margin:0">Execution Tasks</h2>
                    <p class="text-dim text-sm" style="margin-top:0.25rem">Convert validation insights into real-world action items.</p>
                </div>
                <button class="btn btn-primary" onclick="window.Tasks.showNewTaskModal()">+ Add Task</button>
            </div>
            
            <div class="tasks-grid" style="display:grid; gap:1rem">
                ${tasks.length === 0 ? emptyState() : tasks.map(t => taskCard(t)).join('')}
            </div>
        `;
    }

    function emptyState() {
        return `
            <div class="card" style="text-align:center; padding:3rem">
                <div style="font-size:2rem; margin-bottom:1rem">📋</div>
                <h3 style="margin-bottom:0.5rem">No tasks yet</h3>
                <p class="text-dim text-sm">Create your first task to begin executing on this idea.</p>
            </div>
        `;
    }

    function taskCard(task) {
        const priorityColors = { low: 'var(--text-dim)', medium: 'var(--info)', high: 'var(--improve)', urgent: 'var(--kill)' };
        const statusColors = { planned: 'var(--text-dim)', in_progress: 'var(--info)', testing: 'var(--improve)', completed: 'var(--go)', blocked: 'var(--kill)' };

        return `
            <div class="card task-card" style="display:flex; flex-direction:column; gap:0.75rem; border-left:4px solid ${statusColors[task.status] || 'var(--border)'}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start">
                    <h4 style="font-weight:700; margin:0">${app().esc(task.title)}</h4>
                    <span style="font-size:0.7rem; padding:0.15rem 0.5rem; border-radius:999px; background:${priorityColors[task.priority]}15; color:${priorityColors[task.priority]}; font-weight:700; text-transform:uppercase">${app().esc(task.priority)}</span>
                </div>
                ${task.description ? `<p class="text-sm text-dim" style="margin:0">${app().esc(task.description)}</p>` : ''}
                <div style="display:flex; gap:1rem; align-items:center; font-size:0.75rem" class="text-dim">
                    ${task.deadline ? `<span>⏰ Due: ${new Date(task.deadline).toLocaleDateString()}</span>` : ''}
                    <span>📌 ${app().esc(task.status.replace('_', ' ').toUpperCase())}</span>
                    <div style="flex:1; height:4px; background:var(--bg-alt); border-radius:2px; margin-left:1rem">
                        <div style="height:100%; width:${task.progress || 0}%; background:var(--primary); border-radius:2px"></div>
                    </div>
                </div>
            </div>
        `;
    }

    function showNewTaskModal() {
        app().toast('Task creation modal coming soon!', 'info');
    }

    return { init, showNewTaskModal };
})();
