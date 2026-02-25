/**
 * js/collaboration.js
 * Polling-based sync for near-real-time workspace collaboration.
 * Periodically fetches the latest state from the server and updates views.
 */

window.Collaboration = (() => {
    const app = () => window.IdeaApp;
    let pollInterval = null;
    let currentIdeaId = null;
    let lastKnownState = {};
    const POLL_INTERVAL_MS = 8000; // 8 seconds

    function startSync(ideaId) {
        stopSync(); // Clear any existing interval
        currentIdeaId = ideaId;
        lastKnownState = {};
        console.log('[Collab] Starting sync for idea', ideaId);

        // Initial snapshot
        fetchState();

        pollInterval = setInterval(fetchState, POLL_INTERVAL_MS);
    }

    function stopSync() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        currentIdeaId = null;
    }

    async function fetchState() {
        if (!currentIdeaId) return;

        try {
            const [tasks, tabs, stickies] = await Promise.all([
                app().apiFetch(`/ideas/${currentIdeaId}/tasks`).catch(() => null),
                app().api.getTabs(currentIdeaId).catch(() => null),
                fetch(`/api/ideas/${currentIdeaId}/sticky_notes`).then(r => r.json()).catch(() => null)
            ]);

            const newState = {
                taskCount: tasks ? tasks.length : 0,
                tabCount: tabs ? tabs.length : 0,
                stickyCount: stickies ? stickies.length : 0,
                taskHash: tasks ? hashArray(tasks) : '',
                tabHash: tabs ? hashArray(tabs) : '',
                stickyHash: stickies ? hashArray(stickies) : ''
            };

            // Detect changes
            if (lastKnownState.taskHash && lastKnownState.taskHash !== newState.taskHash) {
                console.log('[Collab] Tasks changed remotely');
                notifyChange('tasks', newState.taskCount);
            }

            if (lastKnownState.tabHash && lastKnownState.tabHash !== newState.tabHash) {
                console.log('[Collab] Workspace tabs changed remotely');
                notifyChange('workspace', newState.tabCount);
            }

            if (lastKnownState.stickyHash && lastKnownState.stickyHash !== newState.stickyHash) {
                console.log('[Collab] Sticky notes changed remotely');
                notifyChange('stickies', newState.stickyCount);
            }

            lastKnownState = newState;
        } catch (err) {
            console.warn('[Collab] Sync fetch failed', err);
        }
    }

    function hashArray(arr) {
        // Simple hash for change detection
        return JSON.stringify(arr).length + '_' + (arr.length || 0);
    }

    function notifyChange(resource, count) {
        // Show a subtle toast to inform user of remote changes
        const messages = {
            tasks: `Tasks updated (${count} total)`,
            workspace: `Workspace tabs updated (${count} total)`,
            stickies: `Notes updated (${count} total)`
        };

        if (app().toast) {
            app().toast(`🔄 ${messages[resource] || 'Content updated remotely'}`, 'info');
        }

        // Dispatch custom event for components to listen to
        window.dispatchEvent(new CustomEvent('collab-update', {
            detail: { resource, count }
        }));
    }

    // Allow components to listen for collab updates
    function onUpdate(callback) {
        window.addEventListener('collab-update', (e) => callback(e.detail));
    }

    return { startSync, stopSync, onUpdate };
})();
