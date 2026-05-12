// matrix.js — Eisenhower Decision Matrix
// 3C Goal Tracker · 3C Thread To Success™

import { saveTask, getTasks, deleteTask, genId } from './storage.js';

const QUADRANTS = {
  q1: { label: 'Do First',  sub: 'Urgent + Important',     icon: '🔴' },
  q2: { label: 'Schedule',  sub: 'Important, Not Urgent',   icon: '🟢' },
  q3: { label: 'Delegate',  sub: 'Urgent, Not Important',   icon: '🟡' },
  q4: { label: 'Drop',      sub: 'Not Urgent, Not Important', icon: '⚫' },
};

// ── Render matrix ──────────────────────────────────────────
async function renderMatrix() {
  const tasks = await getTasks();

  Object.keys(QUADRANTS).forEach(qKey => {
    const zone = document.getElementById(`zone-${qKey}`);
    if (!zone) return;

    const qTasks = tasks.filter(t => t.quadrant === qKey);

    // Clear existing chips (keep label)
    zone.querySelectorAll('.task-chip').forEach(c => c.remove());

    qTasks.forEach(task => {
      zone.appendChild(buildChip(task));
    });
  });
}

// ── Build draggable chip ───────────────────────────────────
function buildChip(task) {
  const chip = document.createElement('div');
  chip.className  = 'task-chip';
  chip.draggable  = true;
  chip.dataset.id = task.id;
  chip.innerHTML  = `
    <div class="item-actions">
      <button class="item-action-btn" data-edit-task="${task.id}" title="Edit">&#x270E;</button>
      <button class="item-action-btn save" data-save-task="${task.id}" title="Save" style="display:none;">&#x2713;</button>
      <button class="item-action-btn delete" data-del-task="${task.id}" title="Delete">&#x2715;</button>
    </div>
    <span id="chip-text-${task.id}" style="flex:1; word-break:break-word; padding-right:4px;">${escHtml(task.text)}</span>`;

  // Tap to reveal on mobile
  chip.addEventListener('click', e => {
    if (e.target.closest('.item-action-btn')) return;
    chip.classList.toggle('reveal');
  });

  // Drag events — only when not editing
  chip.addEventListener('dragstart', e => {
    if (chip.querySelector('textarea')) { e.preventDefault(); return; }
    chip.classList.add('dragging');
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  });

  chip.addEventListener('dragend', () => chip.classList.remove('dragging'));

  // Edit
  chip.querySelector('[data-edit-task]').addEventListener('click', e => {
    e.stopPropagation();
    const textEl  = document.getElementById(`chip-text-${task.id}`);
    if (!textEl) return;
    const current = textEl.textContent;
    textEl.innerHTML = `<textarea class="item-edit-area" id="chip-area-${task.id}" style="min-height:48px;">${escHtml(current)}</textarea>`;
    chip.draggable = false;
    e.target.style.display = 'none';
    chip.querySelector(`[data-save-task="${task.id}"]`).style.display = 'flex';
  });

  // Save edit
  chip.querySelector('[data-save-task]').addEventListener('click', async e => {
    e.stopPropagation();
    const area    = document.getElementById(`chip-area-${task.id}`);
    if (!area) return;
    const newText = area.value.trim();
    if (!newText) return;
    task.text = newText;
    await saveTask(task);
    chip.draggable = true;
    const textEl = document.getElementById(`chip-text-${task.id}`);
    if (textEl) textEl.innerHTML = escHtml(newText);
    chip.querySelector(`[data-edit-task="${task.id}"]`).style.display = 'flex';
    e.target.style.display = 'none';
    chip.classList.remove('reveal');
  });

  // Delete
  chip.querySelector('[data-del-task]').addEventListener('click', async e => {
    e.stopPropagation();
    await deleteTask(task.id);
    chip.remove();
  });

  return chip;
}

// ── Drop zones ─────────────────────────────────────────────
function initDropZones() {
  document.querySelectorAll('.matrix-quadrant').forEach(zone => {
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', e => {
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('drag-over');
      }
    });

    zone.addEventListener('drop', async e => {
      e.preventDefault();
      zone.classList.remove('drag-over');

      const taskId  = e.dataTransfer.getData('text/plain');
      const newQ    = zone.dataset.quadrant;
      if (!taskId || !newQ) return;

      // Remove chip from current zone
      const chip = document.querySelector(`.task-chip[data-id="${taskId}"]`);
      if (chip) chip.remove();

      // Update storage
      const tasks   = await getTasks();
      const task    = tasks.find(t => t.id === taskId);
      if (!task) return;
      task.quadrant = newQ;
      await saveTask(task);

      // Add chip to new zone
      zone.appendChild(buildChip(task));
    });
  });
}

// ── Add task ───────────────────────────────────────────────
async function addTask(text, quadrant = 'q1') {
  if (!text.trim()) return;
  const task = await saveTask({ id: genId(), text: text.trim(), quadrant });
  const zone = document.getElementById(`zone-${quadrant}`);
  if (zone) zone.appendChild(buildChip(task));
  return task;
}

// ── Init ───────────────────────────────────────────────────
function initMatrix() {
  renderMatrix();
  initDropZones();

  const form  = document.getElementById('task-form');
  const input = document.getElementById('task-input');
  const sel   = document.getElementById('task-quadrant');

  if (form && input) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      await addTask(text, sel?.value || 'q1');
      input.value = '';
      input.focus();
    });
  }
}

// ── Utility ────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export { initMatrix, renderMatrix, addTask, QUADRANTS };
