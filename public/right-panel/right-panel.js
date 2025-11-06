// right-panel.js — collapse/expand the right panel and update arrow

function toggleRightPanel() {
  const body = document.body;
  const btn = document.getElementById('toggle-right');
  body.classList.toggle('rp-collapsed');

  // arrow direction: ⮜ when panel is open, ⮞ when collapsed
  const collapsed = body.classList.contains('rp-collapsed');
  if (btn) btn.textContent = collapsed ? '⮞' : '⮜';
}

function initRightPanelToggle() {
  const btn = document.getElementById('toggle-right');
  if (!btn) return;
  btn.addEventListener('click', toggleRightPanel);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRightPanelToggle);
} else {
  initRightPanelToggle();
}
