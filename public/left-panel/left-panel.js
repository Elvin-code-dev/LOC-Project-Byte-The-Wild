/* left-panel.js - handle clicks in the left panel list (simple, clear) */

/* Get all list items inside the left panel */
function getLeftPanelListItems() {
  return document.querySelectorAll('.left-panel .division-list li');
}

/* Mark the clicked item as active and remove active from others */
function setActiveLeftPanelItem(clickedItem) {
  const leftPanelListItems = getLeftPanelListItems();
  leftPanelListItems.forEach((listItem) => listItem.classList.remove('active'));
  clickedItem.classList.add('active');
}

/* Start left panel behavior */
function initLeftPanel() {
  const leftPanelListItems = getLeftPanelListItems();
  if (!leftPanelListItems.length) return;

  leftPanelListItems.forEach((listItem) => {
    listItem.addEventListener('click', () => {
      setActiveLeftPanelItem(listItem);
    });
  });
}

/* Start when ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLeftPanel);
} else {
  initLeftPanel();
}
