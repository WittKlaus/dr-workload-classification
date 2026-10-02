// ================================================================================================
// BLOCK 8 · Tab switching and auto-sync bookkeeping
// ------------------------------------------------------------------------------------------------
// Depends : Blocks 5, 13 (maybeSyncCollectToView), 15 (renderRunbookTab).
// Provides: tab buttons, setViewSourceNote(), lastCollectEditAt/lastUploadAt timestamps
// ================================================================================================
// ---------------- Tab switching ----------------
// Auto-sync timestamp: on switching, tab 2 automatically shows the current state of tab 1
// as long as something was edited there since the last manual file upload.
let lastUploadAt = 0;
let lastCollectEditAt = 0;

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('is-active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    btn.classList.add('is-active');
    document.getElementById(btn.getAttribute('data-tab')).classList.remove('hidden');
    window.scrollTo({ top: 0 }); // every view starts at the top; landing mid-page is irritating
    if (btn.getAttribute('data-tab') === 'tab-view' && typeof maybeSyncCollectToView === 'function') {
      maybeSyncCollectToView();
    }
    if (btn.getAttribute('data-tab') === 'tab-runbook' && typeof renderRunbookTab === 'function') {
      renderRunbookTab();
    }
  });
});

function setViewSourceNote(text) {
  const el = document.getElementById('view-source-note');
  if (!el) return;
  if (text) { el.textContent = text; el.classList.remove('hidden'); }
  else { el.classList.add('hidden'); }
}

document.getElementById('btn-print-view').addEventListener('click', () => window.print());
