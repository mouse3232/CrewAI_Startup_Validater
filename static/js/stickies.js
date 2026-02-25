/**
 * Sticky Notes — Global viewport-fixed annotations layer
 * V3: Global, draggable, resizable, pinnable, always on top.
 */

window.StickyNotes = (() => {
    const app = () => window.IdeaApp;
    let currentIdeaId = null;
    let stickies = [];
    let globalWrapper = null;
    let fabBtn = null;
    let eventsBound = false;

    async function init(ideaId) {
        currentIdeaId = ideaId;
        await load();
        injectGlobalUI();
    }

    /** Remove global UI when leaving idea context */
    function destroy() {
        if (globalWrapper) { globalWrapper.remove(); globalWrapper = null; }
        if (fabBtn) { fabBtn.remove(); fabBtn = null; }
        currentIdeaId = null;
        stickies = [];
    }

    async function load() {
        try {
            const res = await fetch(`/api/ideas/${currentIdeaId}/sticky_notes`);
            stickies = await res.json();
        } catch (err) {
            console.error('Failed to load sticky notes', err);
        }
    }

    function injectGlobalUI() {
        // Create or reuse the viewport-fixed wrapper
        if (!globalWrapper) {
            globalWrapper = document.createElement('div');
            globalWrapper.id = 'global-stickies-layer';
            globalWrapper.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                pointer-events: none; z-index: 9990;
            `;
            document.body.appendChild(globalWrapper);
        }

        renderStickies();

        // Bind global drag/resize events only once
        if (!eventsBound) {
            window.addEventListener('mousemove', onGlobalMouseMove);
            window.addEventListener('mouseup', onGlobalMouseUp);
            eventsBound = true;
        }
    }

    // ── Global drag/resize state ──────────────────────────────
    let activeOp = null; // { el, stickyId, type: 'drag'|'resize', startX, startY, origX, origY, origW, origH }

    function onGlobalMouseMove(e) {
        if (!activeOp) return;
        const { el, type, startX, startY, origX, origY, origW, origH } = activeOp;

        if (type === 'drag') {
            const nx = Math.max(0, Math.min(origX + (e.clientX - startX), window.innerWidth - 100));
            const ny = Math.max(0, Math.min(origY + (e.clientY - startY), window.innerHeight - 60));
            el.style.left = nx + 'px';
            el.style.top = ny + 'px';
        } else if (type === 'resize') {
            const nw = Math.max(160, origW + (e.clientX - startX));
            const nh = Math.max(120, origH + (e.clientY - startY));
            el.style.width = nw + 'px';
            el.style.height = nh + 'px';
        }
    }

    function onGlobalMouseUp() {
        if (!activeOp) return;
        const { el, stickyId, type, startX, startY } = activeOp;

        if (type === 'drag') {
            saveSticky(stickyId, {
                position_x: parseInt(el.style.left),
                position_y: parseInt(el.style.top)
            });
        } else if (type === 'resize') {
            saveSticky(stickyId, {
                width: parseInt(el.style.width),
                height: parseInt(el.style.height)
            });
        }

        el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
        activeOp = null;
    }

    // ── Render ────────────────────────────────────────────────
    function renderStickies() {
        if (!globalWrapper) return;
        globalWrapper.innerHTML = '';

        stickies.forEach(s => {
            if (!s.is_visible) return;

            const el = document.createElement('div');
            el.className = `global-sticky color-${s.color || 'yellow'}`;
            const isPinned = s.is_pinned;
            const w = s.width || 220;
            const h = s.height || 200;

            el.style.cssText = `
                position: fixed;
                left: ${s.position_x || 120}px;
                top: ${s.position_y || 120}px;
                width: ${w}px;
                height: ${h}px;
                pointer-events: all;
                z-index: 9992;
                display: flex; flex-direction: column;
                border-radius: 6px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                font-family: 'Inter', sans-serif;
                transition: box-shadow 0.2s;
                overflow: hidden;
                ${isPinned ? 'border: 2px solid rgba(239,68,68,0.6);' : ''}
            `;

            // Apply color
            const colors = {
                yellow: { bg: '#fef9c3', header: '#fde68a', text: '#78350f' },
                blue: { bg: '#dbeafe', header: '#bfdbfe', text: '#1e40af' },
                green: { bg: '#dcfce7', header: '#bbf7d0', text: '#166534' },
                pink: { bg: '#fce7f3', header: '#fbcfe8', text: '#9d174d' },
            };
            const c = colors[s.color] || colors.yellow;
            el.style.background = c.bg;
            el.style.color = c.text;

            const deadlineStr = s.deadline ? new Date(s.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
            const isOverdue = s.deadline && new Date(s.deadline) < new Date();

            el.innerHTML = `
                <div class="gs-header" style="
                    background: ${c.header}; padding: 4px 8px; display: flex;
                    justify-content: space-between; align-items: center; cursor: ${isPinned ? 'default' : 'grab'};
                    user-select: none; flex-shrink: 0; border-bottom: 1px solid rgba(0,0,0,0.06);
                ">
                    <div style="display:flex; gap:4px; align-items:center;">
                        <button class="gs-pin ${isPinned ? 'pinned' : ''}" title="${isPinned ? 'Unpin' : 'Pin position'}" style="
                            border:none; background:none; cursor:pointer; padding:2px; font-size:14px; line-height:1;
                            opacity: ${isPinned ? '1' : '0.5'};
                        ">${isPinned ? '📌' : '📍'}</button>
                        <div class="gs-colors" style="display:flex; gap:3px;">
                            ${['yellow', 'blue', 'green', 'pink'].map(clr => `
                                <div data-c="${clr}" style="width:12px;height:12px;border-radius:50%;cursor:pointer;
                                    background:${colors[clr].header};border:1.5px solid ${s.color === clr ? c.text : 'transparent'};
                                "></div>
                            `).join('')}
                        </div>
                    </div>
                    <button class="gs-del" title="Delete" style="
                        border:none; background:none; cursor:pointer; font-size:16px; line-height:1;
                        color:${c.text}; opacity:0.6; padding:2px;
                    ">×</button>
                </div>
                <textarea class="gs-text" placeholder="Add note..." style="
                    flex: 1; border: none; background: transparent; resize: none;
                    padding: 8px 10px; font-size: 0.82rem; line-height: 1.5;
                    outline: none; color: ${c.text}; font-family: 'Inter', sans-serif;
                ">${app().esc(s.content)}</textarea>
                <div class="gs-footer" style="
                    display:flex; gap:0.4rem; align-items:center; padding:4px 8px;
                    font-size:0.65rem; border-top:1px solid rgba(0,0,0,0.06); flex-shrink:0;
                ">
                    <input type="text" class="gs-assign" placeholder="👤 Assign" value="${app().esc(s.assigned_user || '')}" style="
                        flex:1; border:none; background:transparent; font-size:0.65rem;
                        padding:2px 4px; outline:none; color:${c.text};
                    ">
                    <input type="date" class="gs-deadline" value="${s.deadline ? s.deadline.split('T')[0] : ''}" title="Set deadline" style="
                        border:none; background:transparent; font-size:0.65rem; padding:2px;
                        outline:none; color:${isOverdue ? '#ef4444' : c.text}; width:90px; opacity:0.7;
                    ">
                </div>
                ${deadlineStr ? `<div style="font-size:0.6rem; padding:0 8px 4px; color:${isOverdue ? '#ef4444' : c.text}; font-weight:600; flex-shrink:0;">
                    ${isOverdue ? '⚠️ OVERDUE' : '⏰'} ${deadlineStr}
                </div>` : ''}
                <div class="gs-resize-handle" style="
                    position:absolute; bottom:0; right:0; width:16px; height:16px;
                    cursor: nwse-resize; opacity:0.3;
                    background: linear-gradient(135deg, transparent 50%, ${c.text} 50%);
                    border-bottom-right-radius: 6px;
                "></div>
            `;

            // ── Drag (header) ──
            const header = el.querySelector('.gs-header');
            header.addEventListener('mousedown', (e) => {
                if (e.target.closest('.gs-del') || e.target.closest('.gs-pin') || e.target.closest('.gs-colors') || e.target.closest('[data-c]')) return;
                if (isPinned) return;
                e.preventDefault();
                activeOp = {
                    el, stickyId: s.id, type: 'drag',
                    startX: e.clientX, startY: e.clientY,
                    origX: parseInt(el.style.left), origY: parseInt(el.style.top)
                };
                el.style.boxShadow = '0 12px 32px rgba(0,0,0,0.25)';
                el.style.zIndex = 9995;
            });

            // ── Resize handle ──
            el.querySelector('.gs-resize-handle').addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                activeOp = {
                    el, stickyId: s.id, type: 'resize',
                    startX: e.clientX, startY: e.clientY,
                    origW: parseInt(el.style.width), origH: parseInt(el.style.height)
                };
                el.style.boxShadow = '0 12px 32px rgba(0,0,0,0.25)';
            });

            // ── Content save ──
            const txt = el.querySelector('.gs-text');
            txt.addEventListener('blur', () => {
                if (txt.value !== s.content) saveSticky(s.id, { content: txt.value });
            });

            // ── Assign ──
            const assignInput = el.querySelector('.gs-assign');
            assignInput.addEventListener('blur', () => {
                const val = assignInput.value.trim();
                if (val !== (s.assigned_user || '')) saveSticky(s.id, { assigned_user: val || null });
            });

            // ── Deadline ──
            const deadlineInput = el.querySelector('.gs-deadline');
            deadlineInput.addEventListener('change', () => {
                const val = deadlineInput.value;
                saveSticky(s.id, { deadline: val ? val + 'T00:00:00' : null });
            });

            // ── Pin/Unpin ──
            el.querySelector('.gs-pin').onclick = () => {
                saveSticky(s.id, { is_pinned: !isPinned });
            };

            // ── Delete ──
            el.querySelector('.gs-del').onclick = () => deleteSticky(s.id);

            // ── Color ──
            el.querySelectorAll('[data-c]').forEach(dot => {
                dot.onclick = () => saveSticky(s.id, { color: dot.dataset.c });
            });

            globalWrapper.appendChild(el);
        });
    }

    // ── CRUD helpers ──────────────────────────────────────────
    async function createEmptySticky() {
        try {
            const res = await fetch(`/api/ideas/${currentIdeaId}/sticky_notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: '',
                    section_id: 'general',
                    position_x: 200 + Math.floor(Math.random() * 300),
                    position_y: 100 + Math.floor(Math.random() * 200),
                    width: 220,
                    height: 200
                })
            });
            if (res.ok) {
                await load();
                renderStickies();
                app().toast('Sticky note created', 'success');
            }
        } catch (err) {
            app().toast('Failed to create sticky', 'error');
        }
    }

    async function saveSticky(id, updates) {
        try {
            const res = await fetch(`/api/sticky_notes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                await load();
                renderStickies();
            }
        } catch (err) {
            app().toast('Failed to save', 'error');
        }
    }

    async function deleteSticky(id) {
        if (!confirm('Delete this note?')) return;
        try {
            const res = await fetch(`/api/sticky_notes/${id}`, { method: 'DELETE' });
            if (res.ok) {
                await load();
                renderStickies();
                app().toast('Note deleted', 'info');
            }
        } catch (err) {
            app().toast('Failed to delete', 'error');
        }
    }

    return { init, destroy, createEmptySticky };
})();
