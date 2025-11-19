// cards.js builds the division cards on the dashboard
// each card is clickable and opens the editor for that division

// get the container that holds all cards
function getCardsContainer() {
  return document.querySelector('.cards-grid')
}

// get all card elements
function getCards() {
  return document.querySelectorAll('.cards-grid .card')
}

// make one card active and turn off active on others
function setActiveCard(card) {
  getCards().forEach(c => c.classList.remove('active'))
  card.classList.add('active')
}

// let the rest of the app know which division was clicked
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

// create all the cards on the dashboard
function renderCards(divisions) {
  const box = getCardsContainer()
  if (!box || !Array.isArray(divisions)) return

  // clear old cards
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

    // clicking a card selects the division
    div.addEventListener('click', () => {
      setActiveCard(div)
      announceSelection(d.id, d.divisionName)
    })

    frag.appendChild(div)
  })

  box.appendChild(frag)
}

// allow other scripts to refresh the cards if needed
window.renderCards = renderCards

// run when page loads
function initCards() {
  // if DIVISIONS exists, build cards from it
  if (Array.isArray(window.DIVISIONS)) {
    renderCards(window.DIVISIONS)
  }

  // safety net for static HTML cards
  getCards().forEach(card => {
    card.addEventListener('click', () => {
      setActiveCard(card)

      const id =
        card.getAttribute('data-division-id') ||
        card.textContent.trim()

      const name = (
        card.querySelector('.card-title')?.textContent ||
        card.textContent ||
        ''
      ).trim()

      announceSelection(id, name)
    })
  })
}

// start when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCards)
} else {
  initCards()
}
