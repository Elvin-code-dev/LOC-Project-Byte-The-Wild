/* ============================================================================
   search.js
   Global Google-style search for divisions, programs, people, and notes.
   Teleports user into the division editor and scrolls to specific programs.
   ============================================================================ */


/* ============================================================================
   Element getters
   Keeps DOM access consistent and readable.
   ============================================================================ */
function getSearchBits() {
  return {
    input: document.getElementById('global-search'),
    headerBox: document.querySelector('.header-search'),
    leftItems: document.querySelectorAll('.left-panel .division-list li'),
    cards: document.querySelectorAll('.cards-grid .card')
  }
}


/* ============================================================================
   Basic filter placeholder (not used today but kept for compatibility)
   ============================================================================ */
function applyBasicFilter(query) {
  // intentionally empty
}


/* ============================================================================
   SEARCH INDEX DATA
   All searchable items get added here: divisions, programs, payees, notes.
   ============================================================================ */
let SEARCH_ITEMS = []
let fuse = null
let currentResults = []
let activeIndex = -1


/* ============================================================================
   Build searchable objects for Fuse.js
   ============================================================================ */
function buildSearchItems(divisions) {
  const items = []
  if (!Array.isArray(divisions)) return items

  divisions.forEach((div, idx) => {
    const divisionId = div.id ?? (idx + 1)
    const divName = (div.divisionName || '').trim()
    if (!divName) return

    // Division itself
    items.push({
      kind: 'division',
      divisionId,
      divisionName: divName,
      label: `${divName} — Division`,
      hint: '',
      searchText: `${divName} division`
    })

    // Header people (Dean, Chair, PEN, LOC)
    const headerPeople = [
      { value: div.deanName, role: 'Dean' },
      { value: div.chairName, role: 'Chair' },
      { value: div.penContact, role: 'PEN Contact' },
      { value: div.locRep, role: 'LOC Rep' }
    ]

    headerPeople.forEach(p => {
      const name = (p.value || '').trim()
      if (!name) return

      items.push({
        kind: 'person',
        role: p.role,
        divisionId,
        divisionName: divName,
        label: `${name} — ${p.role} • ${divName}`,
        hint: '',
        searchText: `${name} ${p.role} ${divName}`
      })
    })

    // Programs + payees
    const programs = Array.isArray(div.programList) ? div.programList : []
    programs.forEach(program => {
      const progName = (program.programName || '').trim()

      // Program name
      if (progName) {
        items.push({
          kind: 'program',
          divisionId,
          divisionName: divName,
          programName: progName,
          label: `${progName} — Program • ${divName}`,
          hint: '',
          searchText: `${progName} program ${divName}`
        })
      }

      // Payees inside each program
      const payees = Array.isArray(program.payees) ? program.payees : []
      payees.forEach(payee => {
        const name = (payee.name || '').trim()
        if (!name) return

        items.push({
          kind: 'person',
          role: 'Payee',
          divisionId,
          divisionName: divName,
          programName: progName,
          label: `${name} — Payee • ${progName || ''}${progName ? ', ' : ''}${divName}`,
          hint: '',
          searchText: `${name} ${progName || ''} ${divName} payee`
        })
      })

      // Notes should also be searchable
      const notes = (program.notes || '').trim()
      if (notes && progName) {
        items.push({
          kind: 'notes',
          divisionId,
          divisionName: divName,
          programName: progName,
          label: `${progName} — Notes • ${divName}`,
          hint: notes,
          searchText: `${progName} ${divName} ${notes}`
        })
      }
    })
  })

  return items
}


/* ============================================================================
   Initialize Fuse.js fuzzy search
   ============================================================================ */
function initFuse(divisions) {
  SEARCH_ITEMS = buildSearchItems(divisions)

  if (typeof Fuse === 'undefined') {
    console.warn('Fuse.js not found; dropdown search disabled.')
    fuse = null
    return
  }

  fuse = new Fuse(SEARCH_ITEMS, {
    keys: ['searchText', 'label'],
    threshold: 0.3,
    ignoreLocation: true,
    includeScore: true
  })
}


/* ============================================================================
   Wait until global window.DIVISIONS is populated by script.js
   ============================================================================ */
function whenDivisionsReady(cb) {
  if (Array.isArray(window.DIVISIONS) && window.DIVISIONS.length) {
    cb(window.DIVISIONS)
    return
  }

  let tries = 0
  const maxTries = 200
  const timer = setInterval(() => {
    if (Array.isArray(window.DIVISIONS) && window.DIVISIONS.length) {
      clearInterval(timer)
      cb(window.DIVISIONS)
      return
    }
    tries++
    if (tries > maxTries) {
      clearInterval(timer)
      console.warn('DIVISIONS not ready; search index not built.')
    }
  }, 100)
}


/* ============================================================================
   DROPDOWN UI CREATION + RESET
   ============================================================================ */
let dropdownEl = null

function ensureDropdown() {
  if (dropdownEl) return dropdownEl

  const { headerBox } = getSearchBits()
  if (!headerBox) return null

  const div = document.createElement('div')
  div.id = 'search-dropdown'
  div.className = 'search-dropdown'
  headerBox.appendChild(div)

  dropdownEl = div
  return dropdownEl
}

function clearDropdown() {
  if (!dropdownEl) return
  dropdownEl.innerHTML = ''
  dropdownEl.style.display = 'none'
  currentResults = []
  activeIndex = -1
}

function showDropdown() {
  if (!dropdownEl) return
  dropdownEl.style.display = currentResults.length ? 'block' : 'none'
}


/* ============================================================================
   Rendering dropdown search results
   ============================================================================ */
function renderResults(results) {
  const box = ensureDropdown()
  if (!box) return

  box.innerHTML = ''
  currentResults = results || []
  activeIndex = currentResults.length ? 0 : -1

  if (!currentResults.length) {
    box.style.display = 'none'
    return
  }

  const list = document.createElement('ul')
  list.className = 'search-dropdown__list'

  currentResults.forEach((res, index) => {
    const item = res.item || res

    const li = document.createElement('li')
    li.className = 'search-dropdown__item'
    li.setAttribute('role', 'option')
    li.dataset.index = String(index)

    const main = document.createElement('div')
    main.className = 'search-dropdown__label'
    main.textContent = item.label || ''
    li.appendChild(main)

    if (item.hint) {
      const sub = document.createElement('div')
      sub.className = 'search-dropdown__hint'
      sub.textContent = item.hint
      li.appendChild(sub)
    }

    // mousedown prevents losing focus before click
    li.addEventListener('mousedown', e => {
      e.preventDefault()
      chooseIndex(index)
    })

    list.appendChild(li)
  })

  box.appendChild(list)
  box.style.display = 'block'
  highlightActive()
}


/* ============================================================================
   Highlight selected item (keyboard ↑ ↓ navigation)
   ============================================================================ */
function highlightActive() {
  if (!dropdownEl) return
  dropdownEl.querySelectorAll('.search-dropdown__item').forEach((li, idx) => {
    li.classList.toggle('is-active', idx === activeIndex)
  })
}

function moveActive(delta) {
  if (!currentResults.length) return
  activeIndex += delta
  if (activeIndex < 0) activeIndex = currentResults.length - 1
  if (activeIndex >= currentResults.length) activeIndex = 0
  highlightActive()
}


/* ============================================================================
   Choosing a search result
   ============================================================================ */
function chooseIndex(index) {
  if (!currentResults.length) return
  const res = currentResults[index]
  const item = res && (res.item || res)
  if (!item) return
  goToItem(item)
}


/* ============================================================================
   TELEPORT: open division + optionally scroll to the program card
   ============================================================================ */
function scrollToProgramInEditor(item) {
  const targetName = (item.programName || '').toLowerCase()
  if (!targetName) return

  let tries = 0
  const maxTries = 15

  const timer = setInterval(() => {
    tries++
    const container = document.getElementById('programsEditor')
    if (!container) {
      if (tries >= maxTries) clearInterval(timer)
      return
    }

    const cards = Array.from(container.querySelectorAll('.card'))
    const targetCard = cards.find(card => {
      const nameInput = card.querySelector('[data-field="programName"]')
      if (!nameInput) return false
      const value = (nameInput.value || nameInput.placeholder || '')
        .trim()
        .toLowerCase()
      return value === targetName
    })

    if (!targetCard) {
      if (tries >= maxTries) clearInterval(timer)
      return
    }

    clearInterval(timer)
    targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' })

    targetCard.classList.add('search-highlight')
    setTimeout(() => targetCard.classList.remove('search-highlight'), 1800)
  }, 130)
}


/* ============================================================================
   Route to selected item: open division editor + optional program scroll
   ============================================================================ */
function goToItem(item) {
  clearDropdown()

  const { input } = getSearchBits()
  if (input) {
    input.value = item.label || ''
    applyBasicFilter(input.value)
    input.blur()
  }

  // trigger opening of the division panel
  const detail = {
    id: item.divisionId != null ? String(item.divisionId) : '',
    name: item.divisionName || ''
  }

  if (!detail.id && !detail.name) return

  window.dispatchEvent(
    new CustomEvent('division:selected', { detail })
  )

  // If this search result references a program, scroll to it
  const shouldScroll =
    item.programName &&
    (item.kind === 'program' || item.kind === 'notes' || item.kind === 'person')

  if (shouldScroll) {
    scrollToProgramInEditor(item)
  }
}


/* ============================================================================
   INPUT EVENTS: search typing, arrow keys, focus, clicking outside
   ============================================================================ */
function handleInputChange() {
  const { input } = getSearchBits()
  if (!input) return

  const query = input.value || ''
  applyBasicFilter(query)

  // lazy-init Fuse if DIVISIONS became available
  if (!fuse && Array.isArray(window.DIVISIONS) && window.DIVISIONS.length) {
    initFuse(window.DIVISIONS)
  }

  if (!fuse) {
    clearDropdown()
    return
  }

  const trimmed = query.trim()
  if (!trimmed) {
    clearDropdown()
    return
  }

  const results = fuse.search(trimmed).slice(0, 12)
  renderResults(results)
}

function handleKeyDown(e) {
  if (!dropdownEl || dropdownEl.style.display !== 'block') return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    moveActive(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    moveActive(-1)
  } else if (e.key === 'Enter') {
    if (activeIndex >= 0) {
      e.preventDefault()
      chooseIndex(activeIndex)
    }
  } else if (e.key === 'Escape') {
    clearDropdown()
  }
}

function handleFocus() {
  if (currentResults.length) showDropdown()
}

function handleDocumentClick(e) {
  const { headerBox } = getSearchBits()
  if (!headerBox) return
  if (!headerBox.contains(e.target)) clearDropdown()
}


/* ============================================================================
   Initialize global search when page loads
   ============================================================================ */
function initSearch() {
  const { input } = getSearchBits()
  if (!input) return

  ensureDropdown()

  whenDivisionsReady(divs => initFuse(divs))

  input.addEventListener('input', handleInputChange)
  input.addEventListener('keydown', handleKeyDown)
  input.addEventListener('focus', handleFocus)

  document.addEventListener('click', handleDocumentClick)
}


/* ============================================================================
   Start up
   ============================================================================ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearch)
} else {
  initSearch()
}
