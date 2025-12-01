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
    div.setAttribute('data-division-id', d.id ?? d.divisionName)

    // --- clickable division title ---
    const titleBtn = document.createElement('button')
    titleBtn.type = 'button'
    titleBtn.className = 'card-title card-title-link'
    titleBtn.textContent = d.divisionName || ''

    div.appendChild(titleBtn)

    // when the division title is clicked, open the division editor
    titleBtn.addEventListener('click', (evt) => {
      evt.stopPropagation() // don’t also trigger the card click
      setActiveCard(div)

      const idOrName = d.id ?? d.divisionName
      announceSelection(idOrName, d.divisionName)
    })

    // --- programs list under the title ---
    const programs = Array.isArray(d.programList) ? d.programList : []

    if (programs.length > 0) {
      const programsWrap = document.createElement('div')
      programsWrap.className = 'card-programs'

      const label = document.createElement('div')
      label.className = 'card-programs-label'
      label.textContent = `Programs (${programs.length})`
      programsWrap.appendChild(label)

      const listEl = document.createElement('div')
      listEl.className = 'card-programs-list'

      const maxToShow = 4
      programs.slice(0, maxToShow).forEach(p => {
        const pill = document.createElement('button')
        pill.type = 'button'
        pill.className = 'program-pill'
        pill.textContent = p.programName || 'Untitled'

        // clicking a program opens the editor and scrolls to that program
        pill.addEventListener('click', evt => {
          evt.stopPropagation() // don’t also trigger the card click

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

      if (programs.length > maxToShow) {
        const more = document.createElement('span')
        more.className = 'program-pill more-pill'
        more.textContent = `+${programs.length - maxToShow} more`
        listEl.appendChild(more)
      }

      programsWrap.appendChild(listEl)
      div.appendChild(programsWrap)
    }

    // clicking anywhere on the card (except program pills / title buttons)
    // opens the division editor too
    div.addEventListener('click', () => {
      setActiveCard(div)
      const idOrName = d.id ?? d.divisionName
      announceSelection(idOrName, d.divisionName)
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

  // safety net for any static HTML cards
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
