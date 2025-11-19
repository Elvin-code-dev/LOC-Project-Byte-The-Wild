// left-panel.js builds the list of divisions on the left side
// clicking an item selects the division and updates the rest of the page

// get the list element
function getListEl() {
  return document.querySelector('.left-panel .division-list')
}

// get all list items
function getItems() {
  return document.querySelectorAll('.left-panel .division-list li')
}

// highlight one item and remove active state from others
function setActive(item) {
  getItems().forEach(li => li.classList.remove('active'))
  item.classList.add('active')
}

// tell the app which division was clicked
function announce(id, name) {
  const detail = {
    id: String(id || '').trim(),
    name: String(name || id || '').trim()
  }

  if (!detail.id) return

  window.dispatchEvent(
    new CustomEvent('division:selected', { detail })
  )
}

// build the list using division data
function renderLeftPanel(divisions) {
  const list = getListEl()
  if (!list || !Array.isArray(divisions)) return

  list.innerHTML = ''
  const frag = document.createDocumentFragment()

  divisions.forEach(d => {
    const li = document.createElement('li')
    li.textContent = d.divisionName || String(d.name || '')
    li.setAttribute(
      'data-division-id',
      d.id ?? d.divisionName ?? ''
    )

    // handle click on each item
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

// connect clicks for any static items already in HTML
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

// main start for left panel
// if DIVISIONS is loaded, build the list from it
function initLeftPanel() {
  if (Array.isArray(window.DIVISIONS) && window.DIVISIONS.length) {
    renderLeftPanel(window.DIVISIONS)
  }
  wireStaticItems()
}

// allow other scripts to refresh the list when data changes
window.refreshLeftPanel = renderLeftPanel

// start when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLeftPanel)
} else {
  initLeftPanel()
}
