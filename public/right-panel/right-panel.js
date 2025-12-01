// right-panel.js controls the recent changes panel on the right
// it can collapse or expand and it shows recent submissions from the server

// toggle the right panel open or closed
function toggleRightPanel() {
  const body = document.body
  const btn = document.getElementById('toggle-right')
  //======A Chnge starts =======
  const panel = document.getElementById('right-panel')
  //======A Chnge ends ===

  body.classList.toggle('rp-collapsed')
  //======A Chnge starts ====
  // ALSO toggle the per-panel collapsed class (used especially on mobile)
  if (panel) {
    panel.classList.toggle('is-collapsed')
  }
  //======A Chnge ends =====


  // arrow points into the page when open and out when collapsed
  const collapsed = body.classList.contains('rp-collapsed')
  if (btn) btn.textContent = collapsed ? '⮞' : '⮜'
}

// make text like just now or 2 h ago
function timeAgo(date) {
  const now = Date.now()
  const diffMs = now - date.getTime()
  const mins = Math.round(diffMs / 60000)

  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`

  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} h ago`

  const days = Math.round(hrs / 24)
  return `${days} d ago`
}

// fill the recent changes list with items from the server
function renderRecentChanges(items) {
  const list = document.getElementById('recent-changes-list')
  if (!list) return

  if (!items || !items.length) {
    list.innerHTML = '<li class="placeholder">No recent changes yet. Try saving a division.</li>'
    return
  }

  list.innerHTML = items
    .map(item => {
      const dt = new Date(item.created_at)
      const when = timeAgo(dt)
      const programs = item.programCount || 0
      const payees = item.payeeCount || 0

      return `
        <li>
          <strong>${item.divisionName}</strong>
          <span class="to">
            — ${programs} program${programs === 1 ? '' : 's'},
            ${payees} payee${payees === 1 ? '' : 's'}
          </span>
          <span class="when">${when}</span>
        </li>
      `
    })
    .join('')
}

// get recent submissions from the backend
async function loadRecentChanges() {
  try {
    const res = await fetch('/api/submissions/recent', { cache: 'no-store' })
    if (!res.ok) throw new Error('bad status')

    const data = await res.json()
    renderRecentChanges(data)

  } catch (err) {
    console.error('Failed to load recent changes', err)
    const list = document.getElementById('recent-changes-list')
    if (list) {
      list.innerHTML = '<li class="placeholder">Could not load recent changes.</li>'
    }
  }
}

// main start for the right panel
function initRightPanel() {
  const btn = document.getElementById('toggle-right')
  // ====== A chnage start
  const panel = document.getElementById('right-panel')
  //=== end
  if (btn) btn.addEventListener('click', toggleRightPanel)

  // collapse by default on small screens ====== A chnage
  if (window.innerWidth <= 900 && panel) {
    document.body.classList.add('rp-collapsed')
    panel.classList.add('is-collapsed')
    if (btn) btn.textContent = '⮞'
  }
  //==end
  // first load
  loadRecentChanges()

  // refresh every 10 seconds so the panel stays up to date
  //====== I desabled this to reduce the number of error messages on browser untile teh db issue is fixed 
  //setInterval(loadRecentChanges, 10000)
}

// allow other scripts to refresh the panel if they want
window.LOC_refreshRecentChanges = loadRecentChanges

// run when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRightPanel)
} else {
  initRightPanel()
}
