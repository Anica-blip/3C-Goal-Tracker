// goals.js — Goal tracker logic
// 3C Goal Tracker · 3C Thread To Success™

import { saveGoal, getGoals, deleteGoal, genId } from './storage.js';
import { t, getLocale } from './i18n.js';

const MAX_GOALS = 5;

// ── Render all goals ───────────────────────────────────────
async function renderGoals() {
  const container = document.getElementById('goals-list');
  const counter   = document.getElementById('goals-counter');
  if (!container) return;

  const goals = await getGoals();

  if (counter) {
    counter.textContent = `${goals.length} / ${MAX_GOALS}`;
  }

  if (goals.length === 0) {
    container.innerHTML = `
      <div class="text-center" style="padding: 40px 20px;">
        <div style="font-size: 2.4rem; margin-bottom: 12px;">🎯</div>
        <p style="color: var(--text-muted); font-size: 0.9rem;">
          ${t('goals.emptyLine1')}<br />
          ${t('goals.emptyLine2')}
        </p>
      </div>`;
    return;
  }

  container.innerHTML = goals.map(goal => goalCardHTML(goal)).join('');

  // Attach events
  container.querySelectorAll('[data-delete-goal]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('goals.confirmDelete'))) return;
      await deleteGoal(btn.dataset.deleteGoal);
      await renderGoals();
      showToast(t('goals.toastRemoved'));
    });
  });

  container.querySelectorAll('[data-edit-goal]').forEach(btn => {
    btn.addEventListener('click', () => {
      openGoalModal(btn.dataset.editGoal);
    });
  });

  container.querySelectorAll('[data-progress]').forEach(input => {
    input.addEventListener('change', async () => {
      const goals  = await getGoals();
      const goal   = goals.find(g => g.id === input.dataset.progress);
      if (!goal) return;
      goal.progress = parseInt(input.value, 10);
      await saveGoal(goal);
      const bar = document.querySelector(`[data-bar="${input.dataset.progress}"]`);
      if (bar) bar.style.width = `${goal.progress}%`;
    });
  });
}

// ── Goal card HTML ─────────────────────────────────────────
function goalCardHTML(goal) {
  const milestones = (goal.milestones || [])
    .map(m => `<li style="font-size:0.82rem; color:var(--text-muted); margin-bottom:3px;">• ${m}</li>`)
    .join('');

  return `
    <div class="goal-card" id="goal-${goal.id}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:6px;">
        <div class="goal-card__title">${escHtml(goal.title)}</div>
        <div style="display:flex; gap:6px; flex-shrink:0;">
          <button class="btn btn--ghost" style="padding:5px 10px; font-size:0.75rem;"
            data-edit-goal="${goal.id}">${t('goals.editBtn')}</button>
          <button class="btn btn--danger" style="padding:5px 10px; font-size:0.75rem;"
            data-delete-goal="${goal.id}">✕</button>
        </div>
      </div>

      ${goal.why ? `<div class="goal-card__why">"${escHtml(goal.why)}"</div>` : ''}

      ${milestones ? `<ul style="list-style:none; margin-bottom:10px;">${milestones}</ul>` : ''}

      ${goal.reflection ? `
        <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:10px 12px; margin-bottom:10px; font-size:0.82rem; color:var(--text-muted);">
          📝 ${escHtml(goal.reflection)}
        </div>` : ''}

      <div style="display:flex; align-items:center; gap:10px; margin-top:12px;">
        <span style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap;">${t('goals.progress')}</span>
        <input type="range" min="0" max="100" value="${goal.progress || 0}"
          data-progress="${goal.id}"
          style="flex:1; accent-color:var(--purple-mid); cursor:pointer;" />
        <span style="font-size:0.78rem; color:var(--purple-light); min-width:30px; text-align:right;"
          data-bar-label="${goal.id}">${goal.progress || 0}%</span>
      </div>
      <div class="goal-card__progress">
        <div class="goal-card__progress-bar" data-bar="${goal.id}"
          style="width:${goal.progress || 0}%"></div>
      </div>

      <div style="font-size:0.7rem; color:var(--text-muted); margin-top:8px;">
        ${t('goals.addedOn')} ${formatDate(goal.created)}
      </div>
    </div>`;
}

// ── Modal — add / edit goal ────────────────────────────────
async function openGoalModal(editId = null) {
  const goals = await getGoals();

  if (!editId && goals.length >= MAX_GOALS) {
    showToast(t('goals.maxReached'), 'error');
    return;
  }

  const existing = editId ? goals.find(g => g.id === editId) : null;

  document.getElementById('goal-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'goal-modal';
  modal.style.cssText = `
    position:fixed; inset:0; z-index:200;
    background:rgba(13,14,26,0.88);
    backdrop-filter:blur(8px);
    display:flex; align-items:flex-end; justify-content:center;
    padding: 20px;
  `;

  modal.innerHTML = `
    <div class="card card--glass" style="width:100%; max-width:520px; max-height:88vh; overflow-y:auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h3>${existing ? t('goals.modalEdit') : t('goals.modalAdd')}</h3>
        <button id="close-goal-modal" class="btn btn--ghost btn--icon">✕</button>
      </div>

      <div class="form-group">
        <label>${t('goals.labelTitle')}</label>
        <input type="text" id="gf-title" maxlength="120"
          placeholder="${t('goals.phTitle')}"
          value="${escHtml(existing?.title || '')}" />
      </div>

      <div class="form-group">
        <label>${t('goals.labelWhy')}</label>
        <textarea id="gf-why" rows="2" maxlength="300"
          placeholder="${t('goals.phWhy')}">${escHtml(existing?.why || '')}</textarea>
      </div>

      <div class="form-group">
        <label>${t('goals.labelMilestones')}</label>
        <textarea id="gf-milestones" rows="3" maxlength="400"
          placeholder="${t('goals.phMilestones')}">${(existing?.milestones || []).join('\n')}</textarea>
      </div>

      <div class="form-group">
        <label>${t('goals.labelReflection')}</label>
        <textarea id="gf-reflection" rows="2" maxlength="400"
          placeholder="${t('goals.phReflection')}">${escHtml(existing?.reflection || '')}</textarea>
      </div>

      <div style="display:flex; gap:10px; margin-top:8px;">
        <button id="save-goal-btn" class="btn btn--primary btn--full">
          ${existing ? t('goals.btnUpdate') : t('goals.btnSave')}
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  document.getElementById('close-goal-modal').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  document.getElementById('save-goal-btn').addEventListener('click', async () => {
    const title = document.getElementById('gf-title').value.trim();
    if (!title) { showToast(t('goals.toastNoTitle'), 'error'); return; }

    const milestones = document.getElementById('gf-milestones').value
      .split('\n').map(s => s.trim()).filter(Boolean).slice(0, 3);

    const record = {
      id:         existing?.id || genId(),
      title,
      why:        document.getElementById('gf-why').value.trim(),
      milestones,
      reflection: document.getElementById('gf-reflection').value.trim(),
      progress:   existing?.progress || 0,
      created:    existing?.created  || new Date().toISOString(),
    };

    await saveGoal(record);
    modal.remove();
    await renderGoals();
    showToast(existing ? t('goals.toastUpdated') : t('goals.toastSaved'));
  });
}

// ── Utilities ──────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(getLocale(), {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast toast--${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Init ───────────────────────────────────────────────────
function initGoals() {
  renderGoals();

  const addBtn = document.getElementById('add-goal-btn');
  if (addBtn) addBtn.addEventListener('click', () => openGoalModal());
}

export { initGoals, renderGoals, openGoalModal };
