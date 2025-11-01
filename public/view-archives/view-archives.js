/* view-archives.js - open/close the bottom "View Archives" drawer */

/* Get needed elements */
function getArchivesElements() {
  return {
    archivesSection: document.getElementById('archives-section'), 
    archivesToggleButton: document.getElementById('archives-toggle'), 
    archivesBody: document.getElementById('archives-body') 
  };
}

/* open or close the archives drawer by toggling the collapsed class had help with this*/
function toggleArchivesSection() {
  const { archivesSection, archivesToggleButton } = getArchivesElements();
  if (!archivesSection || !archivesToggleButton) return;

  // if it had collapsed, remove it (open). if it didnt, add it (close)
  const isCollapsed = archivesSection.classList.toggle('collapsed');

  // update aria-expanded on the button for accessibility
  archivesToggleButton.setAttribute('aria-expanded', String(!isCollapsed));

  // after the small transition, keep two-row layout tidy if the function exists
  setTimeout(() => {
    if (typeof fitCardsTwoRows === 'function') {
      fitCardsTwoRows();
    }
  }, 180);
}

/* Hook up the button and Esc key cool assebilty thing */
function initArchives() {
  const { archivesSection, archivesToggleButton } = getArchivesElements();
  if (!archivesSection || !archivesToggleButton) return;

  // start with correct aria state based on initial "collapsed"
  const initiallyCollapsed = archivesSection.classList.contains('collapsed');
  archivesToggleButton.setAttribute('aria-expanded', String(!initiallyCollapsed));
  archivesToggleButton.setAttribute('aria-controls', 'archives-body');

  // Click to toggle
  archivesToggleButton.addEventListener('click', toggleArchivesSection);

  // Allow closing with Escape when open
  document.addEventListener('keydown', (event) => {
    const isCollapsed = archivesSection.classList.contains('collapsed');
    if (event.key === 'Escape' && !isCollapsed) {
      toggleArchivesSection();
    }
  });
}

/* Start when ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initArchives);
} else {
  initArchives();
}
