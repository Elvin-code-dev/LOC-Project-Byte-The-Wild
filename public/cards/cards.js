/* ============================================================================
   cards.js
   Builds the Division Cards on the Dashboard.

   Each card:
   • Displays a division name
   • Highlights when selected
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

/**
 * Let the rest of the app know a division was chosen.
 * edit.js listens for this event.
 */
function announceSelection(id, name) {
  const detail = {
    id: String(id || '').trim(),
    name: String(name || id || '').trim()
  }

  if (!detail.id) return

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
    div.setAttribute('data-division-id', d.id)

    const title = document.createElement('div')
    title.className = 'card-title'
    title.textContent = d.divisionName || ''

    div.appendChild(title)

    /** Clicking a card selects the division */
    div.addEventListener('click', () => {
      setActiveCard(div)
      announceSelection(d.id, d.divisionName)
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
