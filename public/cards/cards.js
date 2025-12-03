/* ============================================================================
   cards.js
   Builds the Division Cards on the Dashboard.

   Each card:
   • Displays a division name
   • Shows all programs inside the card
   • Programs marked for improvement are sorted to the top
   • Programs marked for improvement get a special highlight class
   • Highlights the card when selected
   • Dispatches "division:selected" so edit.js can load the division
   ============================================================================ */


/* ============================================================================
   Helpers
   ============================================================================ */

/** Short helper to get the card grid container */
function getCardsContainer() {
  return document.querySelector('.cards-grid')
}

/** Get all card elements already rendered */
function getCards() {
  return document.querySelectorAll('.cards-grid .card')
}

/** Apply active style to clicked card */
function setActiveCard(card) {
  getCards().forEach(c => c.classList.remove('active'))
  card.classList.add('active')
}

// return true if a program is marked for improvement (from DB or schedule)
function isProgramMarkedForImprovement(p) {
  if (!p) return false

  const raw =
    p.selectedForImprovement ??
    p.improvementSelected ??
    p.markedForImprovement ??
    p.marked_for_improvement

  if (raw == null) return false

  // handle different data types (bool, number, string)
  if (typeof raw === 'string') {
    const v = raw.toLowerCase()
    return v === '1' || v === 'true' || v === 'yes' || v === 'y'
  }

  return !!raw
}


/**
 * Let the rest of the app know a division was chosen.
 * edit.js listens for this event.
 */
function announceSelection(id, name) {
  const cleanId = String(id ?? '').trim()
  const cleanName = String(name ?? '').trim()

  // Fall back: if there is no numeric/real id, use the division name as "id"
  const finalId = cleanId || cleanName

  if (!finalId) {
    console.warn('announceSelection: missing id and name')
    return
  }

  const detail = {
    id: finalId,
    name: cleanName || finalId
  }

  console.log('🔥 dispatch division:selected', detail)

  window.dispatchEvent(
    new CustomEvent('division:selected', { detail })
  )
}


/* ============================================================================
   Card Rendering
   ============================================================================ */

/**
 * Render all division cards on the dashboard grid.
 * Accepts an array of division objects from the server or window.DIVISIONS.
 */
function renderCards(divisions) {
  const box = getCardsContainer()
  if (!box || !Array.isArray(divisions)) return

  // clear any old cards first
  box.innerHTML = ''

  const frag = document.createDocumentFragment()

  divisions.forEach(d => {
    const div = document.createElement('div')
    div.className = 'card'
    div.setAttribute('data-division-id', d.id ?? d.divisionName)

    // --- clickable division title ---
    const titleBtn = document.createElement('button')
    titleBtn.type = 'button'
    titleBtn.className = 'card-title card-title-link'
    titleBtn.textContent = d.divisionName || ''

    div.appendChild(titleBtn)

    // when the division title is clicked, open the division editor
    titleBtn.addEventListener('click', (evt) => {
      evt.stopPropagation() 
      setActiveCard(div)

      const idOrName = d.id ?? d.divisionName
      announceSelection(idOrName, d.divisionName)
    })

    // --- programs list under the title ---
    let programs = Array.isArray(d.programList) ? [...d.programList] : []

    if (programs.length > 0) {
      // sort so "selected for improvement" programs are at the top
      programs.sort((a, b) => {
        const aSelected = isProgramMarkedForImprovement(a)
        const bSelected = isProgramMarkedForImprovement(b)

        if (aSelected === bSelected) return 0
        return aSelected ? -1 : 1
      })


      const programsWrap = document.createElement('div')
      programsWrap.className = 'card-programs'

      const label = document.createElement('div')
      label.className = 'card-programs-label'
      label.textContent = `Programs (${programs.length})`
      programsWrap.appendChild(label)

      const listEl = document.createElement('div')
      listEl.className = 'card-programs-list'

      // show ALL programs in the card
      programs.forEach(p => {
        const pill = document.createElement('button')
        pill.type = 'button'
        pill.className = 'program-pill'
        pill.textContent = p.programName || 'Untitled'

        // highlight if this program is selected for improvement
        if (isProgramMarkedForImprovement(p)) {
          pill.classList.add('program-pill-improvement') 
        }


        // clicking a program opens the editor and scrolls to that program
        pill.addEventListener('click', evt => {
          evt.stopPropagation() 

          window.dispatchEvent(new CustomEvent('program:selected', {
            detail: {
              divisionId: d.id ?? d.divisionName,
              divisionName: d.divisionName,
              programName: p.programName || ''
            }
          }))
        })

        listEl.appendChild(pill)
      })

      programsWrap.appendChild(listEl)
      div.appendChild(programsWrap)
    }

    // Clicking a card selects the division
    div.addEventListener('click', () => {
      setActiveCard(div)
      const idOrName = d.id ?? d.divisionName
      announceSelection(idOrName, d.divisionName)
    })

    frag.appendChild(div)
  })

  box.appendChild(frag)
}

// expose to window so other scripts can re-render cards
window.renderCards = renderCards


/* ============================================================================
   Initialization
   ============================================================================ */

/**
 * If window.DIVISIONS exists (loaded from server),
 * build the cards automatically.
 * Also supports static fallback HTML cards.
 */
function initCards() {
  if (Array.isArray(window.DIVISIONS)) {
    renderCards(window.DIVISIONS)
  }

  // fallback for static <div class="card">
  getCards().forEach(card => {
    card.addEventListener('click', () => {
      setActiveCard(card)

      const id =
        card.getAttribute('data-division-id') ||
        card.textContent.trim()

      const name =
        card.querySelector('.card-title')?.textContent?.trim() ||
        card.textContent.trim()

      announceSelection(id, name)
    })
  })
}

/* Run when DOM is ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCards)
} else {
  initCards()
}
