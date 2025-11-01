/* search.js - filter the left list and the cards as you type */

/* Get references we need */
function getSearchElements() {
  return {
    searchInput: document.getElementById('global-search'),
    leftPanelListItems: document.querySelectorAll('.left-panel .division-list li'),
    cardElements: document.querySelectorAll('.cards-grid .card')
  };
}

/* Apply text filter to both the left panel list and the cards */
function applySearchFilter(queryText) {
  const searchText = (queryText || '').trim().toLowerCase();
  const { leftPanelListItems, cardElements } = getSearchElements();

  // Left panel list items
  leftPanelListItems.forEach((listItem) => {
    const listItemText = (listItem.textContent || '').toLowerCase();
    const shouldShow = (searchText === '' || listItemText.includes(searchText));
    listItem.style.display = shouldShow ? '' : 'none';
  });

  // Cards
  cardElements.forEach((cardElement) => {
    const cardText = (cardElement.textContent || '').toLowerCase();
    const shouldShow = (searchText === '' || cardText.includes(searchText));
    cardElement.style.display = shouldShow ? '' : 'none';
  });

  // Keep two-row layout tidy and CLEANNNNN
  if (typeof fitCardsTwoRows === 'function') {
    fitCardsTwoRows();
  }
}

/* Start search behavior */
function initSearch() {
  const { searchInput } = getSearchElements();
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    applySearchFilter(searchInput.value);
  });
}

/* Start when ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearch);
} else {
  initSearch();
}
