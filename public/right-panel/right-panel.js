// This file opens/closes the right panel and then updates heights

(() => {
  // ----- get elements we use -----
  const body       = document.body;
  const panel      = document.querySelector('.right-panel');
  const toggle     = document.querySelector('.toggle-btn');
  const cardsWrap  = document.querySelector('.cards-wrap');
  const leftPanel  = document.querySelector('.left-panel');

  // ----- limit how often we run on resize -----
  function debounce(fn, wait = 120) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); };
  }

  // ----- keep both side panels from being too tall -----
  function fitSidePanels() {
    const maxH = Math.max(320, window.innerHeight - 130);
    const set = (root, sel) => {
      if (!root) return;
      const bodyEl = root.querySelector(sel) || root;
      bodyEl.style.maxHeight = maxH + 'px';
      bodyEl.style.overflowY = 'auto';
    };
    set(panel, '.rp-body');
    set(leftPanel, '.lp-body');
  }

  // ----- keep cards area at exactly 2 rows, then scroll -----
  function fitCardsTwoRows() {
    if (!cardsWrap) return;

    // find one card to measure
    const firstCard = cardsWrap.querySelector('.card, .dashboard-card, .grid-card');
    if (!firstCard) return;

    // read card height and grid gap
    const cardH = firstCard.getBoundingClientRect().height || 160;
    const gap = parseInt(getComputedStyle(cardsWrap).gap || '16', 10);

    // 2 rows height + gaps + small padding
    const target = (cardH * 2) + (gap * 1) + 8;

    // also keep within viewport so we never leave a big blank area
    const top = cardsWrap.getBoundingClientRect().top;
    const available = Math.max(260, Math.min(target, window.innerHeight - top - 24));

    // apply height and enable scrolling
    cardsWrap.style.blockSize = available + 'px';
    cardsWrap.style.maxBlockSize = available + 'px';
    cardsWrap.style.overflowY = 'auto';
  }

  // ----- toggle the right panel open/closed -----
  function togglePanel() {
    if (!panel) return;
    panel.classList.toggle('is-collapsed');
    body.classList.toggle('rp-collapsed');
    requestAnimationFrame(() => setTimeout(() => {
      fitSidePanels();
      fitCardsTwoRows();
    }, 180));
  }

  // ----- wire up events -----
  if (toggle) {
    toggle.addEventListener('click', togglePanel);
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('tabindex', '0');
    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePanel(); }
    });
  }

  window.addEventListener('resize', debounce(() => {
    fitSidePanels();
    fitCardsTwoRows();
  }, 120));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      fitSidePanels();
      fitCardsTwoRows();
    });
  } else {
    fitSidePanels();
    fitCardsTwoRows();
  }
})();
