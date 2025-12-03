/* ============================================================================
   right-panel.js
   Controls the "Recent Changes" panel on the right side of the app.

   Features:
   - Expand / collapse the right panel
   - Fetch recent submissions from the server
   - Build summaries like “Dean: John → Mary”
   - Show "time ago" text
   - Highlight changes per division
   - Auto-refresh every 10 seconds
   ============================================================================ */


/* ============================================================================
   TOGGLE RIGHT PANEL (the slide-in / slide-out animation)
   ============================================================================ */
function toggleRightPanel() {
  const body = document.body
  const btn = document.getElementById('toggle-right')
  const panel = document.getElementById('right-panel')

  // Collapse/expand
  body.classList.toggle('rp-collapsed')
  if (panel) panel.classList.toggle('is-collapsed')

  // Update arrow icon
  const collapsed = body.classList.contains('rp-collapsed')
  if (btn) btn.textContent = collapsed ? '⮞' : '⮜'
}


/* ============================================================================
   SMALL HELPER FUNCTIONS
   ============================================================================ */

// Convert timestamp → “5 min ago”
function rpTimeAgo(date) {
  const now = Date.now()
  const diffMs = now - date.getTime()
  const mins = Math.round(diffMs / 60000)

  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`

  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} h ago`

  const days = Math.round(hrs / 24)
  if (days < 30) return `${days} days ago`

  const months = Math.round(days / 30)
  if (months < 12) return `${months} months ago`

  const years = Math.round(months / 12)
  return `${years} years ago`
}

// Format currency nicely
function rpDollar(n) {
  const num = Number(n)
  if (!Number.isFinite(num) || num === 0) return ''
  return num.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
}


/* ============================================================================
   FIRST SNAPSHOT SUMMARY (when a division is saved for the first time)
   ============================================================================ */
function rpInitialSummary(item) {
  const parts = []

  if (item.programCount > 0)
    parts.push(`${item.programCount} program${item.programCount === 1 ? '' : 's'}`)

  if (item.payeeCount > 0)
    parts.push(`${item.payeeCount} payee${item.payeeCount === 1 ? '' : 's'}`)

  const dollars = rpDollar(item.totalAmount)
  if (dollars) parts.push(dollars)

  if (parts.length) return `Initial save · ${parts.join(' · ')}`

  if ((item.notes || '').trim()) return 'Initial save · Notes added'

  return 'Initial save for this division'
}


/* ============================================================================
   COMPARE TWO SNAPSHOTS → BUILD HUMAN-READABLE TEXT
   ex: Dean: Alice → Bob · Programs: +2 · Notes updated
   ============================================================================ */
function rpDiffSummary(prev, curr) {
  const pieces = []

  // === 1. FIELD CHANGES (Dean, Chair, Pen, LOC)
  const fieldLabels = [
    ['dean', 'Dean'],
    ['chair', 'Chair'],
    ['pen', 'Pen contact'],
    ['loc', 'LOC rep']
  ]

  const fieldChanges = []

  fieldLabels.forEach(([key, label]) => {
    const before = (prev[key] || '').trim()
    const after = (curr[key] || '').trim()
    if (before !== after) {
      fieldChanges.push({ label, before, after })
    }
  })

  // Show top 2 fields, then “+X more”
  if (fieldChanges.length) {
    const fieldBits = fieldChanges.slice(0, 2).map(change => {
      const from = change.before || '—'
      const to = change.after || '—'
      return `${change.label}: ${from} → ${to}`
    })

    if (fieldChanges.length > 2) {
      const extra = fieldChanges.length - 2
      fieldBits.push(`+${extra} more field${extra === 1 ? '' : 's'}`)
    }

    pieces.push('Fields changed: ' + fieldBits.join(' · '))
  }

  // === 2. COUNTS (program count, payee count, total dollars)
  const progDelta = (curr.programCount || 0) - (prev.programCount || 0)
  const payeeDelta = (curr.payeeCount || 0) - (prev.payeeCount || 0)
  const amountDelta = (curr.totalAmount || 0) - (prev.totalAmount || 0)

  const countBits = []

  if (progDelta > 0) countBits.push(`Programs: +${progDelta}`)
  else if (progDelta < 0) countBits.push(`Programs: ${progDelta}`)

  if (payeeDelta > 0) countBits.push(`Payees: +${payeeDelta}`)
  else if (payeeDelta < 0) countBits.push(`Payees: ${payeeDelta}`)

  if (amountDelta > 0) countBits.push(`Funding: +${rpDollar(amountDelta)}`)
  else if (amountDelta < 0) countBits.push(`Funding: -${rpDollar(-amountDelta)}`)

  if (countBits.length) pieces.push(countBits.join(' · '))

  // === 3. Notes changed
  const prevNotes = (prev.notes || '').trim()
  const currNotes = (curr.notes || '').trim()

  if (prevNotes !== currNotes && currNotes) {
    pieces.push('Notes updated')
  }

  // If nothing major changed
  if (!pieces.length) return 'Changes saved (program details updated)'

  return pieces.join(' · ')
}


/* ============================================================================
   BUILD DIFF SUMMARY MAP
   snapshotId -> summary text
   ============================================================================ */
function rpBuildDiffSummaries(items) {
  const byId = {}
  const sorted = items
    .slice()
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

  const prevByDivision = {}

  for (const item of sorted) {
    const key = item.division_id || item.divisionName || 'unknown'
    const prev = prevByDivision[key]

    if (prev) {
      byId[item.id] = rpDiffSummary(prev, item)
    }

    prevByDivision[key] = item
  }

  return byId
}


/* ============================================================================
   RENDER RECENT CHANGES LIST
   ============================================================================ */
function rpRenderRecentChanges(items, diffSummaries) {
  const list = document.getElementById('recent-changes-list')
  if (!list) return

  // Show placeholder when nothing yet saved
  if (!items || !items.length) {
    list.innerHTML =
      '<li class="placeholder">No recent changes yet. Try saving a division.</li>'
    return
  }

  list.innerHTML = items
    .map(item => {
      const dt = new Date(item.created_at)
      const when = isNaN(dt.getTime()) ? '' : rpTimeAgo(dt)
      const division = item.divisionName || 'Unknown division'

      const summary =
        (diffSummaries && diffSummaries[item.id]) ||
        rpInitialSummary(item)

      const rawNotes = (item.notes || '').trim()
      const notesPreview =
        rawNotes.length > 140 ? rawNotes.slice(0, 137) + '…' : rawNotes

      return `
        <li>
          <div class="rc-head">
            <strong>${division}</strong>
            ${when ? `<span class="when">${when}</span>` : ''}
          </div>
          <div class="to">${summary}</div>
          ${
            notesPreview
              ? `<div class="rc-notes">Notes: ${notesPreview}</div>`
              : ''
          }
        </li>
      `
    })
    .join('')
}


/* ============================================================================
   LOAD RECENT CHANGES FROM API
   ============================================================================ */
async function rpLoadRecentChanges() {
  try {
    const res = await fetch('/api/submissions?limit=120', { cache: 'no-store' })
    if (!res.ok) throw new Error('bad status')

    const data = await res.json()
    const diffSummaries = rpBuildDiffSummaries(data)
    const recent = data.slice(0, 30)

    rpRenderRecentChanges(recent, diffSummaries)
  } catch (err) {
    console.error('Failed to load recent changes', err)
    const list = document.getElementById('recent-changes-list')
    if (list) {
      list.innerHTML =
        '<li class="placeholder">Could not load recent changes.</li>'
    }
  }
}


/* ============================================================================
   INITIALIZE RIGHT PANEL
   ============================================================================ */
function initRightPanel() {
  const btn = document.getElementById('toggle-right')
  const panel = document.getElementById('right-panel')

  // Attach toggle button
  if (btn) btn.addEventListener('click', toggleRightPanel)

  // Auto-collapse on smaller screens
  if (window.innerWidth <= 900 && panel) {
    document.body.classList.add('rp-collapsed')
    panel.classList.add('is-collapsed')
    if (btn) btn.textContent = '⮞'
  }

  // Load immediately + refresh every 10 seconds
  rpLoadRecentChanges()
  setInterval(rpLoadRecentChanges, 10000)
}

// Allow other scripts to refresh the panel
window.LOC_refreshRecentChanges = rpLoadRecentChanges


/* ============================================================================
   STARTUP
   ============================================================================ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRightPanel)
} else {
  initRightPanel()
}
