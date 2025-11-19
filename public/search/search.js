// search.js filters the left panel list and the cards while typing

// get all elements we need for searching
function getSearchElements() {
  return {
    searchInput: document.getElementById('global-search'),
    leftPanelListItems: document.querySelectorAll('.left-panel .division-list li'),
    cardElements: document.querySelectorAll('.cards-grid .card')
  }
}

// apply the text search to both the list and the cards
function applySearchFilter(queryText) {
  const searchText = (queryText || '').trim().toLowerCase()
  const { leftPanelListItems, cardElements } = getSearchElements()

  // filter left panel items
  leftPanelListItems.forEach(listItem => {
    const text = (listItem.textContent || '').toLowerCase()
    const show = searchText === '' || text.includes(searchText)
    listItem.style.display = show ? '' : 'none'
  })

  // filter cards
  cardElements.forEach(card => {
    const text = (card.textContent || '').toLowerCase()
    const show = searchText === '' || text.includes(searchText)
    card.style.display = show ? '' : 'none'
  })

  // adjust layout if a helper function exists
  if (typeof fitCardsTwoRows === 'function') {
    fitCardsTwoRows()
  }
}

// set up live searching
function initSearch() {
  const { searchInput } = getSearchElements()
  if (!searchInput) return

  searchInput.addEventListener('input', () => {
    applySearchFilter(searchInput.value)
  })
}

// start when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearch)
} else {
  initSearch()
}
