// script.js wires up the main dashboard
// it loads divisions, merges local edits, and builds the View Final table

let cacheDivisions = null
let isFinalVisible = false

/* load division data from the API or from local JSON */

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

/* once DOM is ready share divisions as window.DIVISIONS so other scripts can use it */

document.addEventListener('DOMContentLoaded', async () => {
  const divisions = await loadDivisions()
  window.DIVISIONS = divisions
  console.log('Loaded divisions:', divisions)

  // if cards.js is loaded, rebuild the cards with full data
  if (typeof window.renderCards === 'function') {
    window.renderCards(divisions)
  }
})

/* read local edits store used by edit.js */

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem('loc_division_edits_v1') || '{}')
  } catch {
    return {}
  }
}

/* build key based on id for local storage */

function keyId(id) {
  const n = Number(id)
  return Number.isFinite(n) && n > 0 ? `id:${n}` : null
}

/* build key based on division name for local storage */

function keyName(name) {
  const s = String(name || '').trim().toLowerCase()
  return s ? `name:${s}` : null
}

/* merge local edits on top of live division data */

function mergeEdits(divs) {
  const store = readLocal()

  return divs.map(d => {
    const name = (d.divisionName || '').trim()
    const id = d.id

    const keysToTry = [
      keyId(id),
      keyName(name),
      name   // older format that used raw name as key
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

/* show only cards grid on the page */

function showCardsOnly() {
  document.getElementById('cards-wrap')?.classList.remove('hidden')

  const ed = document.getElementById('division-detail')
  if (ed) ed.style.display = 'none'

  const fv = document.getElementById('final-view')
  if (fv) fv.style.display = 'none'

  setFinalButton(false)
}

/* show only final table on the page */

function showFinalOnly() {
  document.getElementById('cards-wrap')?.classList.add('hidden')

  const ed = document.getElementById('division-detail')
  if (ed) ed.style.display = 'none'

  const fv = document.getElementById('final-view')
  if (fv) fv.style.display = 'block'

  // if (fv) {
  //   window.scrollTo({ top: fv.offsetTop - 10, behavior: 'smooth' })
  // }
  document.body.classList.remove('showing-final')

  setFinalButton(true)
}

/* update the label on the view final button */

function setFinalButton(active) {
  const btn = document.getElementById('view-final-btn')
  isFinalVisible = !!active
  if (btn) btn.textContent = active ? 'Back to Dashboard' : 'View Final'
}

/* format a number as dollars for the rollup view */

function dollar(n) {
  const num = Number(n)
  if (!isFinite(num)) return ''
  return num.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
}

/* build the final summary table based on header layout */

async function buildFinalTable() {
  const base = await loadDivisions()
  const divisions = mergeEdits(base)

  // // read header columns and build a signature string
  // const ths = Array.from(document.querySelectorAll('#final-table thead th'))
  // const headers = ths.map(th => th.textContent.trim())
  // const signature = headers.join('|').toLowerCase()

  // =======code replaced by A

  // read header columns and build a signature string
  const ths = Array.from(document.querySelectorAll('#final-table thead th'))

  // ignore the first (control) column when building the signature
  const headers = ths.map(th => th.textContent.trim())

  // .filter(text => text !== '') // ignore the blank control header

  const signature = headers.join('|').toLowerCase()

  ///========== code replaced until here 


  const tbody = document.querySelector('#final-table tbody')
  if (!tbody) throw new Error('final-table not found')

  const rows = []

  // layout A full detail with PEN and LOC
  if (signature === 'division|dean|chair|pen|loc|program|payees|paid|report|notes') {
    divisions.forEach(d => {
      const list = Array.isArray(d.programList) && d.programList.length
        ? d.programList
        : [null]

      list.forEach(p => {
        const payees = p?.payees
          ? p.payees.map(pe => pe.name).join(', ')
          : ''
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
  // layout B roll up view with total payees and total dollars
  else if (signature === 'division|dean|pen|loc|chair|# programs|total payees|total $') {
    divisions.forEach(d => {
      const list = Array.isArray(d.programList) ? d.programList : []
      const numPrograms = list.length
      let totalPayees = 0
      let totalAmount = 0

      list.forEach(p => {
        const payees = Array.isArray(p?.payees) ? p.payees : []
        totalPayees += payees.length
        payees.forEach(pe => {
          totalAmount += Number(pe.amount) || 0
        })
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
  // layout C same as A but without PEN and LOC columns
  else if (signature === 'division|dean|chair|program|payees|paid|report|notes') {
    divisions.forEach(d => {
      const list = Array.isArray(d.programList) && d.programList.length
        ? d.programList
        : [null]

      list.forEach(p => {
        const payees = p?.payees
          ? p.payees.map(pe => pe.name).join(', ')
          : ''
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
  // fallback layout only shows division and program name
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

  // paint rows to tbody to match current header count
  const colCount = headers.length


  tbody.innerHTML = rows
    .map(r => {
      const cells = []
      // control column for Responsive (+ / - icon)
      //cells.push('<td></td>')
      //add actual data coloumns
      for (let i = 0; i < colCount; i++) {
        cells.push(`<td>${String(r[i] ?? '')}</td>`)
      }
      return `<tr>${cells.join('')}</tr>`
    })
    .join('')

  // set up DataTable if library is loaded
  // set up DataTable if library is loaded
  if (window.DataTable) {
    if (window.__finalTableInstance) {
      window.__finalTableInstance.destroy()
    }

    const opts = {
      destroy: true,
      autoWidth: false,
      scrollCollapse: true,
      pageLength: 25,
      order: [[0, 'asc'], [3, 'asc']],
      //responsive: true,   // let DataTables Responsive handle + / - automatically



      // Use Responsive extension with a control column
      // Tell Responsive to use the *first column* as the control
      responsive: {
        details: {
          type: 'column',  // use a column with the dtr-control class
          target: 0        // index 0 = "Division" column
        }
      },


      columnDefs: [
        {
          targets: 0,             // first column
          className: 'dt-control', // Responsive CSS will add the ▶ / ▼ icon
          orderable: true
        }
      ]
    }
    window.__finalTableInstance = new DataTable('#final-table', opts)
  }
}


/* handle clicks on View Final button */

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

/* when a division is selected hide the final view */

function onDivisionSelected() {
  document.getElementById('cards-wrap')?.classList.add('hidden')
  const fv = document.getElementById('final-view')
  if (fv) fv.style.display = 'none'
}

/* wire up events for main buttons and global events */

function wire() {
  const btn = document.getElementById('view-final-btn')
  if (btn) btn.addEventListener('click', onViewFinalClick)

  window.addEventListener('division:selected', onDivisionSelected)
}

/* start wiring when DOM is ready */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wire)
} else {
  wire()
}
