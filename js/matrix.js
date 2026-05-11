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
    <span style="flex:1; word-break:break-word;">${escHtml(task.text)}</span>
    <button data-del="${task.id}" style="background:none; border:none; color:var(--text-muted);
      cursor:pointer; font-size:0.85rem; flex-shrink:0; padding:0 2px;"
      title="Remove task">✕</button>`;

  // Drag events
  chip.addEventListener('dragstart', e => {
    chip.classList.add('dragging');
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  });

  chip.addEventListener('dragend', () => {
    chip.classList.remove('dragging');
  });

  // Delete
  chip.querySelector('[data-del]').addEventListener('click', async () => {
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
