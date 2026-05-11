// voice.js — Voice recording + Web Speech transcription
// 3C Goal Tracker · 3C Thread To Success™

import { saveNote, getNotes, deleteNote, genId } from './storage.js';

let mediaRecorder   = null;
let isRecording     = false;
let timerInterval   = null;
let secondsElapsed  = 0;
let recognition     = null;
let liveTranscript  = '';

// ── Web Speech setup ───────────────────────────────────────
function buildRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) return null;

  const r          = new SpeechRecognition();
  r.continuous     = true;
  r.interimResults = true;
  r.lang           = navigator.language || 'en-US';

  r.onresult = (e) => {
    let interim = '';
    let final   = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t;
      else interim += t;
    }
    liveTranscript += final;
    updateTranscriptUI(liveTranscript + (interim ? ` ${interim}` : ''));
  };

  r.onerror = (e) => {
    if (e.error !== 'no-speech') {
      console.warn('Speech recognition error:', e.error);
    }
  };

  return r;
}

// ── Start recording ────────────────────────────────────────
async function startRecording() {
  if (isRecording) return;

  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showToast('Microphone access denied — check browser permissions.', 'error');
    return;
  }

  liveTranscript = '';
  updateTranscriptUI('');

  // Start speech recognition (transcription only — no audio stored)
  recognition = buildRecognition();
  if (recognition) {
    recognition.start();
  } else {
    updateStatusUI('Voice-to-text not available in this browser — recording timer only.');
  }

  isRecording    = true;
  secondsElapsed = 0;

  updateRecordBtn(true);
  startTimer();
}

// ── Stop recording ─────────────────────────────────────────
async function stopRecording() {
  if (!isRecording) return;

  if (recognition) {
    recognition.stop();
    recognition = null;
  }

  isRecording = false;
  stopTimer();
  updateRecordBtn(false);

  const transcript = liveTranscript.trim();

  if (!transcript) {
    updateStatusUI('No speech detected. Try again or check microphone.');
    return;
  }

  // Save transcript as a voice note
  const note = await saveNote({
    id:      genId(),
    text:    transcript,
    type:    'voice',
    created: new Date().toISOString(),
  });

  updateStatusUI('Voice note saved ✅');
  await renderVoiceNotes();
  return note;
}

// ── Timer ──────────────────────────────────────────────────
function startTimer() {
  const el = document.getElementById('voice-timer');
  timerInterval = setInterval(() => {
    secondsElapsed++;
    if (el) el.textContent = formatTime(secondsElapsed);
    // Auto-stop at 5 minutes
    if (secondsElapsed >= 300) stopRecording();
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval  = null;
  secondsElapsed = 0;
  const el = document.getElementById('voice-timer');
  if (el) el.textContent = '00:00';
}

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

// ── UI helpers ─────────────────────────────────────────────
function updateRecordBtn(active) {
  const btn = document.getElementById('record-btn');
  const lbl = document.getElementById('record-label');
  if (!btn) return;

  if (active) {
    btn.classList.add('recording');
    btn.innerHTML = '⏹';
    if (lbl) lbl.textContent = 'Tap to stop';
  } else {
    btn.classList.remove('recording');
    btn.innerHTML = '🎙️';
    if (lbl) lbl.textContent = 'Tap to record';
  }
}

function updateTranscriptUI(text) {
  const el = document.getElementById('voice-transcript');
  if (el) el.textContent = text || '';
}

function updateStatusUI(text) {
  const el = document.getElementById('voice-status');
  if (el) el.textContent = text;
}

// ── Render saved voice notes ───────────────────────────────
async function renderVoiceNotes() {
  const container = document.getElementById('voice-notes-list');
  if (!container) return;

  const all    = await getNotes();
  const voices = all.filter(n => n.type === 'voice');

  if (voices.length === 0) {
    container.innerHTML = `
      <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:20px 0;">
        No voice notes yet. Record your first thought.
      </p>`;
    return;
  }

  container.innerHTML = voices.map(n => `
    <div class="note-item" id="vnote-${n.id}">
      <div style="flex:1;">
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
          <span style="font-size:0.75rem; color:var(--purple-light); font-weight:700;">🎙️ Voice</span>
          <span class="note-item__date">${formatDate(n.created)}</span>
        </div>
        <div class="note-item__text">${escHtml(n.text)}</div>
      </div>
      <div style="display:flex; flex-direction:column; gap:6px; flex-shrink:0;">
        <button class="btn btn--glass" style="padding:5px 10px; font-size:0.75rem;"
          onclick="shareNote('${escHtml(n.text)}')">Share</button>
        <button class="btn btn--danger" style="padding:5px 10px; font-size:0.75rem;"
          data-del-voice="${n.id}">✕</button>
      </div>
    </div>`).join('');

  container.querySelectorAll('[data-del-voice]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteNote(btn.dataset.delVoice);
      await renderVoiceNotes();
    });
  });
}

// ── Share note via Web Share API ───────────────────────────
function shareNote(text) {
  if (navigator.share) {
    navigator.share({ title: '3C Voice Note', text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard ✅');
    });
  }
}

// ── Utilities ──────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
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
function initVoice() {
  const btn = document.getElementById('record-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      if (isRecording) stopRecording();
      else startRecording();
    });
  }

  // Check support
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    updateStatusUI('⚠️ Voice transcription works best in Chrome or Edge.');
  } else {
    updateStatusUI('Ready to record. Tap the mic to start.');
  }

  renderVoiceNotes();
}

export { initVoice, renderVoiceNotes, shareNote };
