// ================================================================================================
// BLOCK 19 · Settings and UX shell: theme, easter egg, feedback link, runtime-error banner, welcome modal
// ------------------------------------------------------------------------------------------------
// Depends : Blocks 4, 5, 7, 11, 15 (rerenderAllViews).
// Provides: applyTheme(), feedbackUrl()/openFeedback() (GitHub issue link), showRuntimeError(),
//           openWelcome(); device settings in localStorage (never in the progress file)
// ================================================================================================
// ---------------- Settings: theme, easter egg, feedback, welcome (v0.11.0; colorblind switch removed in v0.16.0) ----------------
// Device settings (localStorage, NOT in the progress JSON, like the language choice):
const THEME_KEY = 'dr_theme';         // 'dark' | 'light'
const COMIC_KEY = 'dr_comic';         // '1' = Easteregg aktiv

function rerenderAllViews() {
  if (typeof renderOptionsTable === 'function') renderOptionsTable();
  if (collectState.items.length) renderCollectTable();
  if (currentViewItems && currentViewItems.length) renderAll(currentViewItems);
  const rb = document.getElementById('tab-runbook');
  if (rb && !rb.classList.contains('hidden') && typeof renderRunbookTab === 'function') renderRunbookTab();
}

function updateOptsStates() {
  const dark = document.documentElement.classList.contains('theme-dark');
  document.getElementById('opt-dark-state').textContent = dark ? tr('AN', 'ON') : tr('AUS', 'OFF');
}

function applyTheme(dark, persist) {
  document.documentElement.classList.toggle('theme-dark', dark);
  if (persist) { try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (e) {} }
  updateOptsStates();
  rerenderAllViews(); // graph/charts read their colors from the CSS variables when they are built
}
function applyComic(on, persist) {
  document.documentElement.classList.toggle('font-comic', on);
  if (persist) { try { on ? localStorage.setItem(COMIC_KEY, '1') : localStorage.removeItem(COMIC_KEY); } catch (e) {} }
}

// ---- Options menu ----
const optsMenu = document.getElementById('opts-menu');
document.getElementById('btn-opts-menu').addEventListener('click', (e) => {
  e.stopPropagation();
  optsMenu.classList.toggle('open');
  updateOptsStates();
});
document.addEventListener('click', (e) => {
  if (optsMenu.classList.contains('open') && !optsMenu.contains(e.target)) optsMenu.classList.remove('open');
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') optsMenu.classList.remove('open'); });
document.getElementById('opt-dark').addEventListener('click', () => {
  applyTheme(!document.documentElement.classList.contains('theme-dark'), true);
});

// ---- Feedback (GitHub Issues) ----
function feedbackUrl() {
  // Opens a prefilled GitHub issue (title + body as URL parameters). A pure link, no data retrieval;
  // nothing is sent before the user submits the issue on GitHub. Replaced the mailto in v0.14.1.
  const title = encodeURIComponent('[' + TOOL_VERSION + '] ' + tr('Feedback / Problem', 'Feedback / issue'));
  const errLine = lastRuntimeError ? tr('\nLetzter Laufzeitfehler: ', '\nLast runtime error: ') + lastRuntimeError : '';
  const body = encodeURIComponent(tr(
    'Was ist passiert / Idee:\n\n\nSchritte zum Nachstellen (bei Fehlern):\n1. \n2. \n\n—\nVersion: ' + TOOL_VERSION + '\nSprache: ' + LANG + '\nBrowser: ' + navigator.userAgent + errLine,
    'What happened / idea:\n\n\nSteps to reproduce (for bugs):\n1. \n2. \n\n—\nVersion: ' + TOOL_VERSION + '\nLanguage: ' + LANG + '\nBrowser: ' + navigator.userAgent + errLine));
  return REPO_URL + '/issues/new?title=' + title + '&body=' + body;
}
function openFeedback() { window.open(feedbackUrl(), '_blank', 'noopener'); }
document.getElementById('btn-report-issue').addEventListener('click', openFeedback);
document.getElementById('opt-feedback').addEventListener('click', () => { optsMenu.classList.remove('open'); openFeedback(); });
document.getElementById('welcome-feedback-link').addEventListener('click', (e) => { e.preventDefault(); openFeedback(); });

// ---- Global error catcher (v0.12.1) ----
// Unhandled runtime errors used to end up only in the browser console; to the user it looked as if
// "simply nothing" happened. Now: a visible banner with a short message, a hint to autosave/JSON
// export and a direct way to report the error (prefilled error text). Purely local.
let lastRuntimeError = '';
function showRuntimeError(msg) {
  lastRuntimeError = String(msg || 'Unknown error').slice(0, 600);
  const banner = document.getElementById('runtime-error-banner');
  if (!banner) return;
  document.getElementById('runtime-error-text').textContent =
    tr('⚠ Unerwarteter Fehler: ', '⚠ Unexpected error: ') + lastRuntimeError +
    tr(' — Der Arbeitsstand ist per Autosave gesichert; bitte den Fortschritt zusätzlich als JSON speichern und den Fehler melden.',
       ' — Your work is kept by autosave; please also save your progress as JSON and report the error.');
  banner.classList.remove('hidden');
}
window.addEventListener('error', (e) => {
  const msg = e.message || (e.error && e.error.message);
  if (!msg) return; // resource errors without a message (do not exist here; everything is embedded)
  showRuntimeError(msg + (e.lineno ? ' (line ' + e.lineno + ')' : ''));
});
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason;
  showRuntimeError(r && r.message ? r.message : String(r));
});
document.getElementById('btn-runtime-error-close').addEventListener('click', () => {
  document.getElementById('runtime-error-banner').classList.add('hidden');
});
document.getElementById('btn-runtime-error-report').addEventListener('click', openFeedback);

// ---- "Before you begin" modal ----
// Default: appears on EVERY start/reload (the disclaimer is the safety net). The user can opt out via
// the checkbox; what is remembered is the acknowledged VERSION, i.e. after every release the modal
// appears once again. Can be reopened any time from the options menu.
const WELCOME_KEY = 'dr_welcome_ack'; // value = acknowledged version (only when "remember" is ticked)
function openWelcome() {
  const remembered = (function () { try { return localStorage.getItem(WELCOME_KEY); } catch (e) { return null; } })();
  document.getElementById('welcome-remember').checked = remembered === TOOL_VERSION;
  document.getElementById('welcome-overlay').classList.add('open');
  if (typeof i18nApply === 'function') i18nApply(document.getElementById('welcome-overlay'));
}
document.getElementById('welcome-version').textContent = TOOL_VERSION;
window.addEventListener('DOMContentLoaded', () => {
  let ack = null;
  try { ack = localStorage.getItem(WELCOME_KEY); } catch (e) {}
  if (ack !== TOOL_VERSION) openWelcome();
});
document.getElementById('btn-welcome-ack').addEventListener('click', () => {
  try {
    if (document.getElementById('welcome-remember').checked) localStorage.setItem(WELCOME_KEY, TOOL_VERSION);
    else localStorage.removeItem(WELCOME_KEY);
  } catch (e) { /* non-fatal */ }
  document.getElementById('welcome-overlay').classList.remove('open');
});
document.getElementById('opt-welcome').addEventListener('click', () => {
  optsMenu.classList.remove('open');
  openWelcome();
});

// ---- Easter egg: 5 quick clicks on the BETA badge (status bar) toggle the comic font ----
(function () {
  const badge = document.querySelector('.statusbar .statusbar__beta');
  if (!badge) return;
  let clicks = [];
  badge.style.cursor = 'default';
  badge.addEventListener('click', () => {
    const now = Date.now();
    clicks = clicks.filter(t => now - t < 3000);
    clicks.push(now);
    if (clicks.length >= 5) {
      clicks = [];
      const on = !document.documentElement.classList.contains('font-comic');
      applyComic(on, true);
      const toast = document.createElement('div');
      toast.textContent = on ? '🎉 Comic mode!' : '🧐 ' + tr('Zurück zum Ernst des Lebens.', 'Back to business.');
      toast.style.cssText = 'position:fixed; bottom:56px; right:18px; z-index:400; background:var(--vm-ink-2); color:var(--vm-grey-100); padding:10px 16px; border-radius:99999px; font:600 13px/18px var(--font-sans); box-shadow:var(--shadow-card);';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2200);
    }
  });
})();

// ---- Apply stored device settings (relevant before the first real render) ----
try {
  if (localStorage.getItem(COMIC_KEY) === '1') applyComic(true, false);
  try { localStorage.removeItem('dr_colorblind'); } catch (e) {} // v0.16.0: switch removed, one palette for everyone
  if (localStorage.getItem(THEME_KEY) === 'dark') { document.documentElement.classList.add('theme-dark'); }
  updateOptsStates();
  rerenderAllViews();
} catch (e) { /* localStorage unavailable; defaults apply */ }
