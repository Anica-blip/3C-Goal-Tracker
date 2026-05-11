// camera.js — Camera capture for handwritten notes
// Dash Notes · 3C Thread To Success™
// Images stay on device — not stored in app data

// ── Init ───────────────────────────────────────────────────
function initCamera() {
  const cameraInput = document.getElementById('camera-input');
  const cameraZone  = document.getElementById('camera-zone');
  const preview     = document.getElementById('camera-preview');

  if (!cameraInput || !cameraZone) return;

  // Tap zone triggers file input
  cameraZone.addEventListener('click', () => cameraInput.click());

  cameraInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.', 'error');
      return;
    }

    const url = URL.createObjectURL(file);
    renderCapturedImage(url, file.name, preview);

    // Reset input so same image can be re-selected if needed
    cameraInput.value = '';
  });
}

// ── Render captured image ──────────────────────────────────
function renderCapturedImage(url, filename, container) {
  if (!container) return;

  container.innerHTML = `
    <div style="position:relative; display:inline-block; width:100%;">
      <img src="${url}" alt="Captured note"
        style="width:100%; max-height:340px; object-fit:contain;
               border-radius:var(--radius-md); display:block;
               border:1px solid var(--border);" />
      <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
        <button id="share-capture-btn" class="btn btn--glass btn--full">
          Share / Save to your notes app
        </button>
        <button id="clear-capture-btn" class="btn btn--danger btn--full">
          Clear
        </button>
      </div>
      <p style="font-size:0.75rem; color:var(--text-muted); margin-top:8px; text-align:center;">
        📷 ${filename} — image stays on your device only
      </p>
    </div>`;

  // Share via Web Share API — user chooses their notes app
  document.getElementById('share-capture-btn')?.addEventListener('click', async () => {
    if (navigator.canShare && navigator.canShare({ files: [] })) {
      try {
        // Fetch blob from object URL to share as file
        const resp  = await fetch(url);
        const blob  = await resp.blob();
        const file  = new File([blob], filename || 'dash-note.jpg', { type: blob.type });
        await navigator.share({
          title: 'Dash Notes — Captured Note',
          files: [file],
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          showToast('Sharing not supported — save the image manually.', 'error');
        }
      }
    } else if (navigator.share) {
      // Text share fallback
      await navigator.share({
        title: 'Dash Notes — Captured Note',
        text: 'I captured a handwritten note in Dash Notes.',
        url: window.location.href,
      }).catch(() => {});
    } else {
      showToast('Use your browser to save or share this image.', 'error');
    }
  });

  document.getElementById('clear-capture-btn')?.addEventListener('click', () => {
    URL.revokeObjectURL(url);
    container.innerHTML = `
      <p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:16px 0;">
        No image captured. Tap the camera area above.
      </p>`;
  });
}

// ── Utility ────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast toast--${type} show`;
  setTimeout(() => t.classList.remove('show'), 3200);
}

export { initCamera };
