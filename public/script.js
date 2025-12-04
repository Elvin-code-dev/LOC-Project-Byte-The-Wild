// ============================================================================
//  script.js — Main Dashboard Controller
//  - Loads divisions from the server
//  - Applies local edits from edit.js
//  - Refreshes: cards, left panel, global search
//  - Builds and shows the “Final View” table
// ============================================================================

let cacheDivisions = null       // cache of divisions to avoid refetch
let isFinalVisible = false      // tracks if final table is currently shown


// ============================================================================
//  Load Divisions (Live API → fallback to JSON)
// ============================================================================
async function loadDivisions() {
  if (cacheDivisions) return cacheDivisions

  try {
    const r = await fetch('/api/divisions', { cache: 'no-store' })
    if (!r.ok) throw new Error('api failed')
    cacheDivisions = await r.json()
  } catch {
    const r = await fetch('/data/divisions.json', { cache: 'no-store' })
    cacheDivisions = await r.json()
  }

  return cacheDivisions
}

// ============================================================================
//  Load all programs that are selected for improvement in the CURRENT year
// ============================================================================
async function loadSelectedProgramsForCurrentYear() {
  try {
    const [yearsRes, schedRes] = await Promise.all([
      fetch('/api/years', { cache: 'no-store' }),
      fetch('/api/schedule', { cache: 'no-store' })
    ])

    if (!yearsRes.ok || !schedRes.ok) {
      console.warn('Could not load years or schedule')
      return new Set()
    }

    const years = await yearsRes.json()
    const schedule = await schedRes.json()

    if (!Array.isArray(years) || !years.length) return new Set()

    // pick current year (is_current = 1). If none, use last year in list
    let currentYear = years.find(y => y.is_current === 1 || y.is_current === true)
    if (!currentYear) currentYear = years[years.length - 1]

    const yearId = currentYear && currentYear.id
    if (!yearId) return new Set()

    const selected = new Set()

    if (Array.isArray(schedule)) {
      schedule.forEach(row => {
        const rowYearId = row.academic_year_id
        const isSelected =
          row.is_selected === 1 ||
          row.is_selected === true ||
          row.is_selected === '1'

        if (rowYearId === yearId && isSelected) {
          selected.add(row.program_id)
        }
      })
    }

    return selected
  } catch (err) {
    console.error('loadSelectedProgramsForCurrentYear error:', err)
    return new Set()
  }
}



// ============================================================================
//  DOM READY → Load divisions + mark schedule-selected programs
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Loading divisions…')

  const base = await loadDivisions()
  const divisions = Array.isArray(base) ? base : []

  // Get all program_ids that are selected for improvement for the current year
  const selectedPrograms = await loadSelectedProgramsForCurrentYear()

  // Attach "selectedForImprovement" flag onto each program object
  const enhancedDivisions = divisions.map(div => {
    const programs = Array.isArray(div.programList)
      ? div.programList.map(p => {
          const hasId = p.id != null
          const fromSchedule = hasId && selectedPrograms.has(p.id)

          const isMarked =
            p.selectedForImprovement ||
            p.improvementSelected ||
            fromSchedule

          return {
            ...p,
            selectedForImprovement: !!isMarked,
            improvementSelected: !!isMarked
          }
        })
      : div.programList

    return {
      ...div,
      programList: programs
    }
  })

  // Expose globally so other modules (cards, search, edit) use the enhanced data
  window.DIVISIONS = enhancedDivisions
  console.log('DIVISIONS loaded with schedule flags:', enhancedDivisions)

  // Update card grid (center panel)
  if (typeof window.renderCards === 'function') {
    console.log('→ renderCards() running…')
    window.renderCards(enhancedDivisions)
  }

  // Update left panel division list
  if (typeof window.refreshLeftPanel === 'function') {
    console.log('→ refreshLeftPanel() running…')
    window.refreshLeftPanel(enhancedDivisions)
  }

  // Prepare global search index
  if (typeof window.LOC_searchInit === 'function') {
    console.log('→ LOC_searchInit() running…')
    window.LOC_searchInit(enhancedDivisions)
  }

  console.log('UI refreshed with updated divisions + improvement flags.')
})




// ============================================================================
//  Local Storage Utilities (Shared with edit.js)
// ============================================================================
function readLocal() {
  try {
    return JSON.parse(localStorage.getItem('loc_division_edits_v1') || '{}')
  } catch {
    return {}
  }
}

function keyId(id) {
  const n = Number(id)
  return Number.isFinite(n) && n > 0 ? `id:${n}` : null
}

function keyName(name) {
  const s = String(name || '').trim().toLowerCase()
  return s ? `name:${s}` : null
}


// ============================================================================
//  Merge Local Edits Onto Live Divisions
//  (Used for final table + dashboard accuracy)
// ============================================================================
function mergeEdits(divs) {
  const store = readLocal()

  return divs.map(d => {
    const name = (d.divisionName || '').trim()
    const id = d.id

    const keysToTry = [
      keyId(id),
      keyName(name),
      name
    ].filter(Boolean)

    let rec = null
    for (const k of keysToTry) {
      if (store[k]) {
        rec = store[k]
        break
      }
    }

    if (!rec) return d

    return {
      ...d,
      divisionName: rec.divisionName || d.divisionName,
      deanName: rec.dean ?? d.deanName,
      chairName: rec.chair ?? d.chairName,
      penContact: rec.pen ?? d.penContact,
      locRep: rec.loc ?? d.locRep,
      notes: rec.notes ?? d.notes,
      programList: Array.isArray(rec.programsData)
        ? rec.programsData
        : d.programList
    }
  })
}


// ============================================================================
//  Dashboard View Switchers
// ============================================================================
function showCardsOnly() {
  document.getElementById('cards-wrap')?.classList.remove('hidden')

  const ed = document.getElementById('division-detail')
  if (ed) ed.style.display = 'none'

  const fv = document.getElementById('final-view')
  if (fv) fv.style.display = 'none'

  setFinalButton(false)
}

function showFinalOnly() {
  document.getElementById('cards-wrap')?.classList.add('hidden')

  const ed = document.getElementById('division-detail')
  if (ed) ed.style.display = 'none'

  const fv = document.getElementById('final-view')
  if (fv) fv.style.display = 'block'

  
  document.body.classList.remove('showing-final')

  setFinalButton(true)
}

function setFinalButton(active) {
  const btn = document.getElementById('view-final-btn')
  isFinalVisible = !!active
  if (btn) btn.textContent = active ? 'Back to Dashboard' : 'View Final'
}


// ============================================================================
//  Money Formatter (used in final summary table)
// ============================================================================
function dollar(n) {
  const num = Number(n)
  if (!isFinite(num)) return ''
  return num.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
}


// ============================================================================
//  Build the "Final View" DataTable
//  This detects the table layout based on the <thead> header names.
// ============================================================================
async function buildFinalTable() {
  const base = await loadDivisions()
  const divisions = mergeEdits(base)

  // Read column headers to detect which layout we are rendering
  const ths = Array.from(document.querySelectorAll('#final-table thead th'))

  
  // so we use the existing first column (Division) as the control.
  const headers = ths.map(th => th.textContent.trim())
  const signature = headers.join('|').toLowerCase()

  const tbody = document.querySelector('#final-table tbody')
  if (!tbody) throw new Error('final-table not found')

  const rows = []
  const colCount = headers.length

  // Full layout with PEN + LOC
  if (signature === 'division|dean|chair|pen|loc|program|payees|paid|report|notes') {
    divisions.forEach(d => {
      const list = Array.isArray(d.programList) && d.programList.length
        ? d.programList
        : [null]

      list.forEach(p => {
        const payees = p?.payees ? p.payees.map(pe => pe.name).join(', ') : ''
        const paid = p ? (p.hasBeenPaid ? 'Yes' : 'No') : ''
        const report = p ? (p.reportSubmitted ? 'Yes' : 'No') : ''

        rows.push([
          d.divisionName || '',
          d.deanName || '',
          d.chairName || '',
          d.penContact || '',
          d.locRep || '',
          p?.programName || '',
          payees,
          paid,
          report,
          p?.notes || d.notes || ''
        ])
      })
    })
  }

  // Roll-up layout with totals
  else if (signature === 'division|dean|pen|loc|chair|# programs|total payees|total $') {
    divisions.forEach(d => {
      const list = Array.isArray(d.programList) ? d.programList : []

      const numPrograms = list.length
      let totalPayees = 0
      let totalAmount = 0

      list.forEach(p => {
        const payees = Array.isArray(p?.payees) ? p.payees : []
        totalPayees += payees.length
        payees.forEach(pe => { totalAmount += Number(pe.amount) || 0 })
      })

      rows.push([
        d.divisionName || '',
        d.deanName || '',
        d.penContact || '',
        d.locRep || '',
        d.chairName || '',
        String(numPrograms),
        String(totalPayees),
        dollar(totalAmount)
      ])
    })
  }

  // Layout without PEN/LOC
  else if (signature === 'division|dean|chair|program|payees|paid|report|notes') {
    divisions.forEach(d => {
      const list = Array.isArray(d.programList) && d.programList.length
        ? d.programList
        : [null]

      list.forEach(p => {
        const payees = p?.payees ? p.payees.map(pe => pe.name).join(', ') : ''
        const paid = p ? (p.hasBeenPaid ? 'Yes' : 'No') : ''
        const report = p ? (p.reportSubmitted ? 'Yes' : 'No') : ''

        rows.push([
          d.divisionName || '',
          d.deanName || '',
          d.chairName || '',
          p?.programName || '',
          payees,
          paid,
          report,
          p?.notes || d.notes || ''
        ])
      })
    })
  }

  // Minimal fallback layout
  else {
    divisions.forEach(d => {
      const list = Array.isArray(d.programList) && d.programList.length
        ? d.programList
        : [null]

      list.forEach(p => {
        rows.push([
          d.divisionName || '',
          p?.programName || ''
        ])
      })
    })
  }

  // Paint table body
  tbody.innerHTML = rows
    .map(r => {
      const cells = []
      // we only output actual data columns — no extra blank control column
      for (let i = 0; i < colCount; i++) {
        cells.push(`<td>${String(r[i] ?? '')}</td>`)
      }
      return `<tr>${cells.join('')}</tr>`
    })
    .join('')

  // Activate DataTables + Responsive extension (arrow / row view)
  if (window.DataTable) {
    if (window.__finalTableInstance) {
      window.__finalTableInstance.destroy()
    }

    const opts = {
      destroy: true,
      autoWidth: false,
      scrollCollapse: true,
      pageLength: 25,
      // sort by Division, and if many columns, also sort by Program
      order: [[0, 'asc']].concat(colCount > 5 ? [[5, 'asc']] : []),

      // Responsive extension: use first column as control with arrow
      responsive: {
        details: {
          type: 'column', 
          target: 0       
        }
      },

      columnDefs: [
        {
          targets: 0,             
          className: 'dt-control', 
          orderable: true
        }
      ]
    }

    window.__finalTableInstance = new DataTable('#final-table', opts)
  }
}


// ============================================================================
//  Event Handlers
// ============================================================================
function onViewFinalClick() {
  if (isFinalVisible) {
    showCardsOnly()
    return
  }

  buildFinalTable()
    .then(showFinalOnly)
    .catch(err => {
      console.error(err)
      alert('Could not load final data')
    })
}

function onDivisionSelected() {
  document.getElementById('cards-wrap')?.classList.add('hidden')
  const fv = document.getElementById('final-view')
  if (fv) fv.style.display = 'none'
}


// ============================================================================
//  Wire Up Button + Events
// ============================================================================
function wire() {
  const btn = document.getElementById('view-final-btn')
  if (btn) btn.addEventListener('click', onViewFinalClick)

  window.addEventListener('division:selected', onDivisionSelected)
}

// Start wiring
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wire)
} else {
  wire()
}
