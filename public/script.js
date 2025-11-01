/* script.js - main layout, right panel toggle, simple sizing */

/* make side panels scroll inside and not be too tall */
function fitSidePanels() {
  const rightPanel = document.querySelector('.right-panel');
  const leftPanel = document.querySelector('.left-panel');

  const maxHeight = Math.max(320, window.innerHeight - 130);

  // Right panel body
  if (rightPanel) {
    const rightPanelBody = rightPanel.querySelector('.rp-body') || rightPanel;
    rightPanelBody.style.maxHeight = maxHeight + 'px';
    rightPanelBody.style.overflowY = 'auto';
  }

  // Left panel body
  if (leftPanel) {
    const leftPanelBody = leftPanel.querySelector('.lp-body') || leftPanel;
    leftPanelBody.style.maxHeight = maxHeight + 'px';
    leftPanelBody.style.overflowY = 'auto';
  }
}

/* keep the cards container at exactly two rows and scroll for more hard to do had help */
function fitCardsTwoRows() {
  const cardsContainer = document.getElementById('cards-wrap');
  if (!cardsContainer) return;

  const cardsGrid = cardsContainer.querySelector('.cards-grid');
  if (!cardsGrid) return;

  const firstCard = cardsGrid.querySelector('.card');
  if (!firstCard) return;

  const cardHeight = firstCard.getBoundingClientRect().height || 160;
  const gridStyle = getComputedStyle(cardsGrid);
  const rowGap = parseInt(gridStyle.gap || '16', 10);

  const twoRowsHeight = (cardHeight * 2) + rowGap + 8;

  const containerTopOffset = cardsContainer.getBoundingClientRect().top;
  const availableSpace = Math.max(
    260,
    Math.min(twoRowsHeight, window.innerHeight - containerTopOffset - 24)
  );

  cardsContainer.style.height = availableSpace + 'px';
  cardsContainer.style.maxHeight = availableSpace + 'px';
  cardsContainer.style.overflowY = 'auto';
  cardsContainer.style.overflowX = 'hidden';
}

/* open or close the right panel */
function toggleRightPanel() {
  const rightPanel = document.querySelector('.right-panel');
  const pageBody = document.body;
  if (!rightPanel) return;

  rightPanel.classList.toggle('is-collapsed');
  pageBody.classList.toggle('rp-collapsed');

  // refit layout after the small CSS transition
  setTimeout(() => {
    fitSidePanels();
    fitCardsTwoRows();
  }, 180);
}

/* Adjust layout on resize or orientation changes */
function handleResizeOrRotate() {
  fitSidePanels();
  fitCardsTwoRows();
}

/* start everything */
function startMain() {
  const toggleRightButton = document.getElementById('toggle-right');
  if (toggleRightButton) {
    toggleRightButton.addEventListener('click', toggleRightPanel);
  }

  window.addEventListener('resize', handleResizeOrRotate);
  window.addEventListener('orientationchange', handleResizeOrRotate);

  fitSidePanels();
  fitCardsTwoRows();
}

/* Boot when ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startMain);
} else {
  startMain();
}
