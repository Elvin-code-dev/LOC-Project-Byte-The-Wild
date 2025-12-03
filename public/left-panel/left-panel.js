/* ============================================================================
   left-panel.js
   Builds and controls the Division List on the left side.

   Features:
   • Display all divisions (vertical list)
   • Clicking a division highlights it
   • Clicking notifies the rest of the app (division:selected)
   • Syncs active highlight when switching via search/history/etc.
   • Supports refreshing list after dynamic changes
   ============================================================================ */


/* ============================================================================
   DOM HELPERS
   ============================================================================ */

// <ul> element where divisions are rendered
function getListEl() {
  return document.querySelector('.left-panel .division-list')
}

// All <li> division entries
function getItems() {
  return document.querySelectorAll('.left-panel .division-list li')
}


/* ============================================================================
   ACTIVE STATE HANDLING
   ============================================================================ */

// Highlight the clicked list item
function setActive(item) {
  getItems().forEach(li => li.classList.remove('active'))
  item.classList.add('active')
}


/* ============================================================================
   DISPATCH EVENT → Tell app "user selected a division"
   ============================================================================ */

function announce(id, name) {
  const detail = {
    id: String(id || '').trim(),
    name: String(name || id || '').trim()
  }

  // Must have an ID to proceed
  if (!detail.id) return

  // Notify entire app (edit.js listens to this)
  window.dispatchEvent(new CustomEvent('division:selected', { detail }))
}


/* ============================================================================
   BUILD LEFT PANEL LIST FROM DIVISIONS[]
   ============================================================================ */

function renderLeftPanel(divisions) {
  const list = getListEl()
  if (!list || !Array.isArray(divisions)) return

  list.innerHTML = ''
  const frag = document.createDocumentFragment()

  divisions.forEach(d => {
    const li = document.createElement('li')
    li.textContent = d.divisionName || String(d.name || '')

    // store ID (or divisionName fallback)
    li.setAttribute(
      'data-division-id',
      d.id ?? d.divisionName ?? ''
    )

    // Clicking an item = activate + announce
    li.addEventListener('click', () => {
      setActive(li)
      const id = li.getAttribute('data-division-id') || li.textContent.trim()
      const name = li.textContent.trim()
      announce(id, name)
    })

    frag.appendChild(li)
  })

  list.appendChild(frag)
}


/* ============================================================================
   CONNECT STATIC ITEMS (in case HTML has preset <li>)
   ============================================================================ */

function wireStaticItems() {
  getItems().forEach(li => {
    li.addEventListener('click', () => {
      setActive(li)
      const id = li.getAttribute('data-division-id') || li.textContent.trim()
      const name = li.textContent.trim()
      announce(id, name)
    })
  })
}


/* ============================================================================
   MAIN INIT
   Runs once the page loads
   ============================================================================ */

function initLeftPanel() {
  // If global DIVISIONS[] already exists, build list
  if (Array.isArray(window.DIVISIONS) && window.DIVISIONS.length) {
    renderLeftPanel(window.DIVISIONS)
  }

  // For any pre-existing <li>
  wireStaticItems()
}


/* ============================================================================
   EXTERNAL REFRESH SUPPORT
   Allows other scripts to rebuild the list after DB updates
   ============================================================================ */

window.refreshLeftPanel = renderLeftPanel


/* ============================================================================
   KEEP ACTIVE ITEM IN SYNC WITH APP STATE
   When search.js or cards.js dispatches "division:selected",
   highlight the corresponding <li>.
   ============================================================================ */

window.addEventListener('division:selected', event => {
  const detail = event.detail || {}
  const id = String(detail.id || '').trim()
  const name = String(detail.name || '').trim().toLowerCase()

  const items = getItems()
  let target = null

  // 1. Try matching by ID
  if (id) {
    items.forEach(li => {
      if (target) return
      const liId = String(li.getAttribute('data-division-id') || '').trim()
      if (liId === id) target = li
    })
  }

  // 2. If no ID match, try by text (name)
  if (!target && name) {
    items.forEach(li => {
      if (target) return
      const liName = li.textContent.trim().toLowerCase()
      if (liName === name) target = li
    })
  }

  // Apply highlight
  if (target) setActive(target)
})


/* ============================================================================
   STARTUP
   ============================================================================ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLeftPanel)
} else {
  initLeftPanel()
}
