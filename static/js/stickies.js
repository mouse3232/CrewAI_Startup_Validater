/**
 * Sticky Notes — contextual annotations overlay for the validation canvas
 */

window.StickyNotes = (() => {
    const app = () => window.IdeaApp;
    let currentIdeaId = null;
    let stickies = [];
    let container = null;

    async function init(ideaId) {
        currentIdeaId = ideaId;
        await load();
        injectUI();
    }

    async function load() {
        try {
            const res = await fetch(`/api/ideas/${currentIdeaId}/stickies`);
            stickies = await res.json();
        } catch (err) {
            console.error('Failed to load sticky notes', err);
        }
    }

    function injectUI() {
        const grid = document.querySelector('.canvas-grid');
        if (!grid) return;

        // Container for stickies
        let wrapper = document.getElementById('stickies-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'stickies-wrapper';
            wrapper.style.position = 'absolute';
            wrapper.style.top = '0';
            wrapper.style.left = '0';
            wrapper.style.width = '100%';
            wrapper.style.height = '100%';
            wrapper.style.pointerEvents = 'none'; // click through empty space
            grid.style.position = 'relative';
            grid.appendChild(wrapper);
        }

        // Add note button
        let addBtn = document.getElementById('add-sticky-btn');
        if (!addBtn) {
            const header = document.querySelector('.canvas-grid').previousElementSibling; // The metrics header
            if (header) {
                addBtn = document.createElement('button');
                addBtn.id = 'add-sticky-btn';
                addBtn.className = 'btn btn-outline text-sm';
                addBtn.innerHTML = '✏️ Add Note';
                addBtn.style.marginLeft = '1rem';
                addBtn.onclick = () => createEmptySticky();

                // insert near heatmap toggle
                const controls = header.querySelector('div') || header;
                controls.appendChild(addBtn);
            }
        }

        renderStickies();
    }

    function renderStickies() {
        const wrapper = document.getElementById('stickies-wrapper');
        if (!wrapper) return;
        wrapper.innerHTML = '';

        stickies.forEach(s => {
            const el = document.createElement('div');
            el.className = `sticky-note color-${s.color || 'yellow'}`;
            el.style.left = `${s.position_x || 50}px`;
            el.style.top = `${s.position_y || 50}px`;

            el.innerHTML = `
                <div class="sticky-header">
                    <button class="sticky-del" title="Delete">×</button>
                    <div class="color-picker">
                        <div class="c-dot yellow" data-c="yellow"></div>
                        <div class="c-dot blue" data-c="blue"></div>
                        <div class="c-dot green" data-c="green"></div>
                        <div class="c-dot pink" data-c="pink"></div>
                    </div>
                </div>
                <textarea class="sticky-text" placeholder="Add note...">${app().esc(s.content)}</textarea>
            `;

            // Make draggable
            let isDragging = false, startX, startY, origX, origY;
            el.addEventListener('mousedown', (e) => {
                if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON' || e.target.classList.contains('c-dot')) return;
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                origX = parseInt(el.style.left);
                origY = parseInt(el.style.top);
                el.style.zIndex = 1000;
            });

            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const wrapperRect = wrapper.getBoundingClientRect();
                let nx = origX + (e.clientX - startX);
                let ny = origY + (e.clientY - startY);
                // quick bounds
                nx = Math.max(0, Math.min(nx, wrapperRect.width - 200));
                ny = Math.max(0, Math.min(ny, wrapperRect.height - 150));

                el.style.left = nx + 'px';
                el.style.top = ny + 'px';
            });

            window.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    el.style.zIndex = 100;
                    saveSticky(s.id, {
                        position_x: parseInt(el.style.left),
                        position_y: parseInt(el.style.top)
                    });
                }
            });

            // Handlers
            const txt = el.querySelector('textarea');
            txt.addEventListener('blur', () => {
                if (txt.value !== s.content) {
                    saveSticky(s.id, { content: txt.value });
                }
            });

            el.querySelector('.sticky-del').onclick = () => deleteSticky(s.id);

            el.querySelectorAll('.c-dot').forEach(dot => {
                dot.onclick = () => {
                    const c = dot.dataset.c;
                    saveSticky(s.id, { color: c });
                };
            });

            wrapper.appendChild(el);
        });
    }

    async function createEmptySticky() {
        try {
            const res = await fetch(`/api/ideas/${currentIdeaId}/stickies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: '',
                    color: 'yellow',
                    position_x: 50,
                    position_y: 50,
                    canvas_block: 'general'
                })
            });
            if (res.ok) {
                await load();
                renderStickies();
            }
        } catch (err) {
            app().toast('Failed to create sticky', 'error');
        }
    }

    async function saveSticky(id, updates) {
        try {
            const res = await fetch(`/api/ideas/${currentIdeaId}/stickies/${id}`, {
                method: 'PATCH',
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
            const res = await fetch(`/api/ideas/${currentIdeaId}/stickies/${id}`, { method: 'DELETE' });
            if (res.ok) {
                await load();
                renderStickies();
            }
        } catch (err) {
            app().toast('Failed to delete', 'error');
        }
    }

    return { init };
})();
