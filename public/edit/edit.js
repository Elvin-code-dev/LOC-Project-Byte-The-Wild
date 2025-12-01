// edit.js handles the division editor on the right side
// it loads division data, merges local drafts, validates fields, and saves to the database
// had allot of help from ai and google to make this work

// small settings for autosave
const EDIT_DEBOUNCE_MS = 700
let EDIT_divisionsCache = null
let EDIT_autosaveTimer = null
let EDIT_dirty = false  // tracks if there are unsaved changes

// wait a short time before autosaving after a change
function debounceSave(fn) {
  clearTimeout(EDIT_autosaveTimer)
  EDIT_autosaveTimer = setTimeout(fn, EDIT_DEBOUNCE_MS)
}

// short helper for single element
function $(s) {
  return document.querySelector(s)
}

// short helper for all elements that match
function $$(s) {
  return Array.from(document.querySelectorAll(s))
}

// add a strong saved flash style to a field or card
function flashSavedStrong(el) {
  if (!el) return
  el.classList.add('just-saved-strong')
  setTimeout(() => el.classList.remove('just-saved-strong'), 2200)
}

// read local drafts from localStorage
function EDIT_readLocal() {
  try {
    return JSON.parse(localStorage.getItem('loc_division_edits_v1') || '{}')
  } catch {
    return {}
  }
}

// write local drafts to localStorage
function EDIT_writeLocal(o) {
  localStorage.setItem('loc_division_edits_v1', JSON.stringify(o || {}))
}

// build a key based on division id
function EDIT_keyId(id) {
  const n = Number(id)
  return Number.isFinite(n) && n > 0 ? `id:${n}` : null
}

// build a key based on division name
function EDIT_keyName(name) {
  const s = String(name || '').trim().toLowerCase()
  return s ? `name:${s}` : null
}

// get a saved local record for this division if it exists
function EDIT_getLocalRecord(id, name) {
  const store = EDIT_readLocal()
  const keys = [EDIT_keyId(id), EDIT_keyName(name)]

  for (const k of keys) {
    if (k && store[k]) return store[k]
  }
  return null
}

// save or update a local record for this division
function EDIT_putLocalRecord(id, name, rec) {
  const store = EDIT_readLocal()
  const kId = EDIT_keyId(id)
  const kName = EDIT_keyName(name)

  if (kId) store[kId] = rec
  if (kName) store[kName] = rec

  EDIT_writeLocal(store)
}

// load all divisions from the server first, then fall back to JSON file
async function EDIT_getDivisions() {
  if (EDIT_divisionsCache) return EDIT_divisionsCache

  try {
    const r = await fetch('/api/divisions', { cache: 'no-store' })
    if (!r.ok) throw 0
    EDIT_divisionsCache = await r.json()
    return EDIT_divisionsCache
  } catch {
    const r = await fetch('/data/divisions.json', { cache: 'no-store' })
    EDIT_divisionsCache = await r.json()
    return EDIT_divisionsCache
  }
}

// load a single division by id from the server
async function EDIT_getDivisionById(id) {
  const r = await fetch(`/api/divisions/${id}`, { cache: 'no-store' })
  if (!r.ok) throw new Error('not found')
  return r.json()
}

// merge live division data with any local draft edits
function EDIT_mergeDivision(base, local) {
  if (!local) return base

  const m = { ...base }

  if (local.divisionName) m.divisionName = local.divisionName
  if (local.dean) m.deanName = local.dean
  if (local.chair) m.chairName = local.chair
  if (local.pen) m.penContact = local.pen
  if (local.loc) m.locRep = local.loc
  if (local.notes) m.notes = local.notes
  if (Array.isArray(local.programsData)) m.programList = local.programsData

  return m
}

// quick way to grab all key elements used in the editor
function EDIT_els() {
  return {
    shell: $('#division-detail'),
    cards: $('#cards-wrap'),
    finalView: $('#final-view'),
    badge: $('#badgeName'),
    idEl: $('#divisionId'),
    nameEl: $('#divisionName'),
    deanEl: $('#deanInput'),
    chairEl: $('#chairInput'),
    penEl: $('#penInput'),
    locEl: $('#locInput'),
    programsEl: $('#programsInput'),
    notesEl: $('#notesInput'),
    backBtn: $('#backToDashboard'),
    resetBtn: $('#resetEdit'),
    saveBtn: $('#saveEdit'),
    programsMount: $('#programsEditor')
  }
}

// set visual state for one input field based on its value
function EDIT_applyFieldState(input) {
  const wrap = input.closest('.edit-field') || input.parentElement
  if (!wrap) return

  // notes field stays neutral
  if (input.id === 'notesInput') {
    wrap.classList.remove('is-tbd')
    wrap.classList.remove('is-ok')
    return
  }

  const raw = String(input.value || '')
  const v = raw.trim().toLowerCase()

  // empty or includes tbd counts as not finished
  const isTBD = v.length === 0 || v.includes('tbd')

  wrap.classList.toggle('is-tbd', isTBD)
  wrap.classList.toggle('is-ok', !isTBD)
}

// update state for all main header fields
function EDIT_applyAllStates() {
  const { nameEl, deanEl, chairEl, penEl, locEl, notesEl } = EDIT_els()
    ;[nameEl, deanEl, chairEl, penEl, locEl, notesEl]
      .filter(Boolean)
      .forEach(EDIT_applyFieldState)
}

// show a small toast box with a message
function EDIT_toast(msg) {
  let t = $('.toast')
  if (!t) {
    t = document.createElement('div')
    t.className = 'toast ok'
    document.body.appendChild(t)
  }

  t.textContent = msg
  t.style.display = 'block'

  clearTimeout(EDIT_toast._t)
  EDIT_toast._t = setTimeout(() => {
    t.style.display = 'none'
  }, 2200)
}

// make sure PEN and LOC fields exist in the editor grid
function EDIT_ensurePeopleFields() {
  const grid = $('#division-detail .edit-grid')
  if (!grid) return

  const mk = (id, label, ph) => {
    if ($('#' + id)) return null

    const w = document.createElement('div')
    w.className = 'edit-field'

    const l = document.createElement('label')
    l.htmlFor = id
    l.textContent = label

    const i = document.createElement('input')
    i.id = id
    i.type = 'text'
    i.placeholder = ph

    w.appendChild(l)
    w.appendChild(i)
    grid.appendChild(w)

    return i
  }

  mk('penInput', 'PEN Contact', 'PEN contact name')
  mk('locInput', 'LOC Rep', 'LOC representative')
}

// show the editor and hide the cards and final view
function EDIT_showEditor() {
  const { shell, cards, finalView } = EDIT_els()

  if (cards) cards.classList.add('hidden')
  if (finalView) finalView.style.display = 'none'

  if (shell) {
    shell.style.display = 'block'
    window.scrollTo({ top: shell.offsetTop - 10, behavior: 'smooth' })
  }
}

// hide the editor and go back to the cards view
function EDIT_backToCards() {
  const { shell, cards } = EDIT_els()

  if (shell) shell.style.display = 'none'
  if (cards) cards.classList.remove('hidden')
}

// show a modal that lists missing required fields
// returns a promise that resolves to true or false
function EDIT_showValidationModal(missingLabels) {
  return new Promise(resolve => {
    let backdrop = document.querySelector('.modal-backdrop')

    if (!backdrop) {
      backdrop = document.createElement('div')
      backdrop.className = 'modal-backdrop'
      backdrop.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true">
          <h3>Some required fields are empty</h3>
          <p>Do you want to <b>mark them as "TBD"</b> and save anyway</p>
          <ul class="missing-list"></ul>
          <div class="actions">
            <button class="btn btn-ghost" data-act="cancel">Cancel</button>
            <button class="btn btn-primary" data-act="proceed">Mark TBD & Save</button>
          </div>
        </div>`
      document.body.appendChild(backdrop)
    }

    backdrop.querySelector('.missing-list').innerHTML = missingLabels
      .map(x => `<li>${x}</li>`)
      .join('')

    backdrop.style.display = 'flex'

    const close = ok => {
      backdrop.style.display = 'none'
      resolve(ok)
    }

    backdrop.querySelector('[data-act="cancel"]').onclick = () => close(false)
    backdrop.querySelector('[data-act="proceed"]').onclick = () => close(true)
  })
}

// check for any missing or invalid required fields
// returns the labels and a helper that fills TBD values for us
function EDIT_collectRequiredIssues() {
  const { nameEl, deanEl, chairEl, penEl, locEl, programsMount } = EDIT_els()
  const issues = []
  const toTBD = []

    // required header fields
    ;[
      { el: nameEl, label: 'Division Name' },
      { el: deanEl, label: 'Dean' },
      { el: chairEl, label: 'Chair' },
      { el: penEl, label: 'PEN Contact' },
      { el: locEl, label: 'LOC Rep' }
    ].forEach(({ el, label }) => {
      const val = String(el?.value || '').trim()
      if (!val) {
        issues.push(label)
        toTBD.push(() => {
          el.value = 'TBD'
          EDIT_applyFieldState(el)
        })
      }
    })

  // programs must have names and payees in Name - Amount format
  const cards = [...programsMount.querySelectorAll('.card')]

  cards.forEach((card, idx) => {
    const nameInput = card.querySelector('[data-field="programName"]')
    const payeesBox = card.querySelector('[data-field="payees"]')

    // program name required
    const pn = String(nameInput?.value || '').trim()
    if (!pn || /^new program$/i.test(pn)) {
      issues.push(`Program ${idx + 1} Name`)
      toTBD.push(() => {
        nameInput.value = 'TBD Program'
        EDIT_applyFieldState(nameInput)
      })
    }

    // payees required and must be valid
    const raw = (payeesBox?.value || '')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)

    if (raw.length === 0) {
      issues.push(`Program ${idx + 1} Payees`)
      toTBD.push(() => {
        payeesBox.value = 'TBD - 0'
        EDIT_applyFieldState(payeesBox)
      })
    } else {
      let hadProblem = false

      raw.forEach(line => {
        const [nm, amtRaw] = line.split('-').map(s => (s || '').trim())
        const amt = Number(amtRaw)
        if (!nm || !Number.isFinite(amt)) {
          hadProblem = true
        }
      })

      if (hadProblem) {
        issues.push(`Program ${idx + 1} Payees (fix Name - Amount)`)
        toTBD.push(() => {
          const fixed = raw
            .map(line => {
              const [nm, amtRaw] = line.split('-').map(s => (s || '').trim())
              const amt = Number(amtRaw)
              if (!nm || !Number.isFinite(amt)) return 'TBD - 0'
              return `${nm} - ${amt}`
            })
            .join('\n')

          payeesBox.value = fixed || 'TBD - 0'
          EDIT_applyFieldState(payeesBox)
        })
      }
    }
  })

  return {
    labels: issues,
    setTBD: () => toTBD.forEach(fn => fn())
  }
}

// wrap an input or area with a label in the edit grid
function EDIT_labelWrap(text, el, full = true) {
  const w = document.createElement('div')
  w.className = `edit-field ${full ? 'full' : ''}`

  if (text) {
    const l = document.createElement('label')
    l.textContent = text
    w.appendChild(l)
  }

  w.appendChild(el)
  return w
}

// build the programs and payees editor inside the division editor
function EDIT_renderProgramsEditor(divRec) {
  const { programsMount } = EDIT_els()
  programsMount.innerHTML = ''

  // remove any old text headers that the HTML might have
  $$('h3, h2').forEach(h => {
    const t = (h.textContent || '').trim().toLowerCase()
    if (
      t === 'programs and payees' &&
      h.parentElement === programsMount.parentElement
    ) {
      h.remove()
    }
  })

  // keep one nice styled header
  let heading = document.getElementById('programsTitle')
  if (!heading) {
    heading = document.createElement('h3')
    heading.id = 'programsTitle'
    heading.className = 'section-title'
    heading.textContent = 'Programs & Payees'
    programsMount.appendChild(heading)
  } else {
    heading.classList.add('section-title')
    heading.textContent = 'Programs & Payees'
  }

  const list = Array.isArray(divRec?.programList) ? divRec.programList : []
  const wrap = document.createElement('div')

  // top bar with add program button
  const topBar = document.createElement('div')
  topBar.className = 'toolbar'

  const addBtn = document.createElement('button')
  addBtn.className = 'btn btn-ghost'
  addBtn.textContent = 'Add Program'

  addBtn.addEventListener('click', () => {
    divRec.programList = divRec.programList || []
    divRec.programList.push({
      programName: 'New Program',
      payees: [],
      hasBeenPaid: false,
      reportSubmitted: false,
      notes: ''
    })
    EDIT_dirty = true
    EDIT_renderProgramsEditor(divRec)
    EDIT_autosaveDraft()
  })

  topBar.appendChild(addBtn)
  programsMount.appendChild(topBar)

  // build a card for each program
  list.forEach((p, idx) => {
    const card = document.createElement('div')
    card.className = 'card'
    card.style.marginBottom = '12px'

    const title = document.createElement('div')
    title.style.fontWeight = '700'
    title.style.marginBottom = '6px'
    title.textContent = `Program ${idx + 1}: ${p.programName || ''}`
    card.appendChild(title)

    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.value = p.programName || ''
    nameInput.placeholder = 'Program name'
    nameInput.dataset.field = 'programName'

    const payeesBox = document.createElement('textarea')
    payeesBox.rows = 3
    payeesBox.placeholder = 'Payees (one per line: Name - Amount)'
    payeesBox.dataset.field = 'payees'
    payeesBox.value = (p.payees || [])
      .map(pe => `${pe.name || ''} - ${pe.amount ?? ''}`)
      .join('\n')

    const row = document.createElement('div')
    row.className = 'inline-row'

    const paid = document.createElement('label')
    paid.className = 'check'
    const paidCb = document.createElement('input')
    paidCb.type = 'checkbox'
    paidCb.checked = !!p.hasBeenPaid
    paidCb.dataset.field = 'hasBeenPaid'
    paid.appendChild(paidCb)
    paid.appendChild(document.createTextNode('Has been paid'))

    const report = document.createElement('label')
    report.className = 'check'
    const reportCb = document.createElement('input')
    reportCb.type = 'checkbox'
    reportCb.checked = !!p.reportSubmitted
    reportCb.dataset.field = 'reportSubmitted'
    report.appendChild(reportCb)
    report.appendChild(document.createTextNode('Report submitted'))

    const delBtn = document.createElement('button')
    delBtn.className = 'btn btn-danger'
    delBtn.textContent = 'Delete Program'
    delBtn.addEventListener('click', () => {
      divRec.programList.splice(idx, 1)
      EDIT_dirty = true
      EDIT_renderProgramsEditor(divRec)
      EDIT_autosaveDraft()
    })

    row.appendChild(paid)
    row.appendChild(report)
    row.appendChild(delBtn)

    const notes = document.createElement('textarea')
    notes.rows = 2
    notes.placeholder = 'Notes'
    notes.value = p.notes || ''
    notes.dataset.field = 'notes'

    const grid = document.createElement('div')
    grid.className = 'edit-grid'
    grid.appendChild(EDIT_labelWrap('Program Name', nameInput))
    grid.appendChild(EDIT_labelWrap('Payees', payeesBox))
    grid.appendChild(EDIT_labelWrap('', row))
    grid.appendChild(EDIT_labelWrap('Notes', notes))

    // mark dirty when program name changes
    const markDirty = () => {
      EDIT_dirty = true
      EDIT_applyFieldState(nameInput)
      debounceSave(EDIT_autosaveDraft)
    }
    nameInput.addEventListener('input', markDirty)
    nameInput.addEventListener('blur', () => EDIT_applyFieldState(nameInput))

    // mark dirty on payees, flags, and notes
    const markDirtyPayees = () => {
      EDIT_dirty = true
      EDIT_applyFieldState(payeesBox)
      debounceSave(EDIT_autosaveDraft)
    }
      ;[payeesBox, paidCb, reportCb, notes].forEach(el => {
        el.addEventListener('input', markDirtyPayees)
        el.addEventListener('change', markDirtyPayees)
      })

    // set initial state
    EDIT_applyFieldState(nameInput)
    EDIT_applyFieldState(payeesBox)

    card.appendChild(grid)
    wrap.appendChild(card)
  })

  programsMount.appendChild(wrap)
}

// fill top header fields with data for this division
function EDIT_fillPeople(recId, recName, rec) {
  EDIT_ensurePeopleFields()

  const {
    badge,
    idEl,
    nameEl,
    deanEl,
    chairEl,
    penEl,
    locEl,
    programsEl,
    notesEl
  } = EDIT_els()

  idEl.value = rec?.id ?? recId ?? recName ?? ''
  nameEl.value = (rec?.divisionName || recName || recId || '').trim()
  deanEl.value = rec?.deanName || ''
  chairEl.value = rec?.chairName || ''
  penEl.value = rec?.penContact || ''
  locEl.value = rec?.locRep || ''
  programsEl.value = Array.isArray(rec?.programList)
    ? String(rec.programList.length)
    : ''
  notesEl.value = rec?.notes || ''

  if (badge) badge.textContent = nameEl.value

  const onDirty = () => {
    EDIT_dirty = true
    debounceSave(EDIT_autosaveDraft)
  }

    ;[nameEl, deanEl, chairEl, penEl, locEl, notesEl].forEach(el => {
      if (!el) return
      EDIT_applyFieldState(el)
      el.addEventListener('input', () => {
        EDIT_applyFieldState(el)
        onDirty()
      })
      el.addEventListener('change', () => {
        EDIT_applyFieldState(el)
        onDirty()
      })
    })
}

// save the current draft to localStorage
function EDIT_saveDraftToLocal() {
  const {
    idEl,
    nameEl,
    deanEl,
    chairEl,
    penEl,
    locEl,
    notesEl,
    programsMount
  } = EDIT_els()

  const idVal = idEl?.value
  const nameVal = (nameEl?.value || '').trim()

  const draft = {
    ...(EDIT_getLocalRecord(idVal, nameVal) || {}),
    divisionName: nameVal,
    dean: (deanEl?.value || '').trim(),
    chair: (chairEl?.value || '').trim(),
    pen: (penEl?.value || '').trim(),
    loc: (locEl?.value || '').trim(),
    notes: (notesEl?.value || '').trim()
  }

  const cards = programsMount.querySelectorAll('.card')
  const updatedPrograms = []

  cards.forEach(c => {
    const programName =
      c.querySelector('[data-field="programName"]')?.value.trim() || ''
    const payeesText =
      c.querySelector('[data-field="payees"]')?.value || ''
    const hasBeenPaid =
      c.querySelector('[data-field="hasBeenPaid"]')?.checked || false
    const reportSubmitted =
      c.querySelector('[data-field="reportSubmitted"]')?.checked || false
    const notes = c.querySelector('[data-field="notes"]')?.value || ''

    const payees = payeesText
      .split('\n')
      .map(line => {
        line = (line || '').trim()
        if (!line) return null
        const [nm, amt] = line.split('-').map(s => (s || '').trim())
        if (!nm) return { name: 'TBD', amount: 0 }
        const num = Number(amt)
        return {
          name: nm,
          amount: Number.isFinite(num) ? num : 0
        }
      })
      .filter(Boolean)

    updatedPrograms.push({
      programName,
      payees,
      hasBeenPaid,
      reportSubmitted,
      notes
    })
  })

  draft.programsData = updatedPrograms

  EDIT_putLocalRecord(idVal, nameVal, draft)
  return draft
}

// simple wrapper used by debounce
function EDIT_autosaveDraft() {
  EDIT_saveDraftToLocal()
}

// send current draft to the server
async function EDIT_sendDraftToServer(draft) {
  try {
    await fetch('/api/division-drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft)
    })
  } catch (err) {
    console.error('Error sending draft to server', err)
  }
}

// main save button logic
// runs validation, fills TBD if approved, saves local and server
async function EDIT_manualSave() {
  const issues = EDIT_collectRequiredIssues()

  if (issues.labels.length) {
    const ok = await EDIT_showValidationModal(issues.labels)
    if (!ok) return
    issues.setTBD()
  }

  const draft = EDIT_saveDraftToLocal()
  EDIT_sendDraftToServer(draft)

  EDIT_dirty = false

  const { nameEl, deanEl, chairEl, penEl, locEl, notesEl } = EDIT_els()
    ;[nameEl, deanEl, chairEl, penEl, locEl, notesEl].forEach(flashSavedStrong)
  $$('#programsEditor .card').forEach(flashSavedStrong)

  EDIT_toast('All changes saved')
}

// clear local edits for this division and reload from base data
function EDIT_resetCurrent() {
  const { idEl, nameEl } = EDIT_els()

  const idVal = idEl?.value
  const nameVal = (nameEl?.value || '').trim()

  const store = EDIT_readLocal()
  const kId = EDIT_keyId(idVal)
  const kName = EDIT_keyName(nameVal)

  if (kId) delete store[kId]
  if (kName) delete store[kName]

  EDIT_writeLocal(store)

  EDIT_dirty = false
  EDIT_toast('Cleared local edits')

  if (idVal || nameVal) EDIT_openEditor(idVal, nameVal)
}

// open the editor for a division by id or name
async function EDIT_openEditor(id, name) {
  let merged
  const nId = Number(id)

  // try server by id first
  if (Number.isFinite(nId) && nId > 0) {
    try {
      const live = await EDIT_getDivisionById(nId)
      const local = EDIT_getLocalRecord(live.id, live.divisionName)
      merged = EDIT_mergeDivision(live, local)
    } catch {
      // fall through to list lookup
    }
  }

  // if that failed, search all divisions for a match by name
  if (!merged) {
    const all = await EDIT_getDivisions()
    const key = String(id || name).toLowerCase()
    const base =
      all.find(d => (d.divisionName || '').toLowerCase() === key) || {
        divisionName: name || id,
        programList: []
      }

    const local = EDIT_getLocalRecord(base.id, base.divisionName)
    merged = EDIT_mergeDivision(base, local)
  }

  EDIT_fillPeople(id, name, merged)
  EDIT_renderProgramsEditor(merged)
  EDIT_showEditor()
}

// ask user if they want to save before leaving editor
// runs validation and fills TBD if needed
async function EDIT_guardBeforeExit(next) {
  if (!EDIT_dirty) {
    next()
    return
  }

  const issues = EDIT_collectRequiredIssues()

  if (!issues.labels.length) {
    next()
    return
  }

  const ok = await EDIT_showValidationModal(issues.labels)
  if (!ok) return

  issues.setTBD()
  EDIT_saveDraftToLocal()
  EDIT_dirty = false
  next()
}

// wire up button actions in the editor
function EDIT_wireButtons() {
  const { backBtn, resetBtn, saveBtn } = EDIT_els()

  if (backBtn) {
    backBtn.addEventListener('click', e => {
      e.preventDefault()
      EDIT_guardBeforeExit(() => EDIT_backToCards())
    })
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', EDIT_resetCurrent)
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', EDIT_manualSave)
  }

  // make the site title act like back to dashboard with guard
  const title = document.querySelector(
    'header h1, .site-title, .brand-title, .header .logo-text, .navbar-brand'
  )

  if (title) {
    title.style.cursor = 'pointer'
    title.addEventListener('click', e => {
      e.preventDefault()
      EDIT_guardBeforeExit(() => EDIT_backToCards())
    })
  }
}

// listen for a division:selected event from cards or left panel
function EDIT_listenSelection() {
  window.addEventListener('division:selected', e => {
    const { id, name } = e.detail || {}
    if (!id && !name) return
    EDIT_guardBeforeExit(() => EDIT_openEditor(id, name))
  })
}

// listen for a program:selected event (from cards)
// open the division editor and scroll to that program’s card
function EDIT_listenProgramSelected() {
  window.addEventListener('program:selected', e => {
    const { divisionId, divisionName, programName } = e.detail || {}
    if (!divisionId && !divisionName) return

    EDIT_guardBeforeExit(async () => {
      // open the editor for that division
      await EDIT_openEditor(divisionId, divisionName)

      if (!programName) return

      // after editor is built, scroll to the matching program card
      const { programsMount } = EDIT_els()
      if (!programsMount) return

      const cards = programsMount.querySelectorAll('.card')
      const targetName = String(programName).trim().toLowerCase()

      for (const card of cards) {
        const nameInput = card.querySelector('[data-field="programName"]')
        if (!nameInput) continue

        const val = (nameInput.value || '').trim().toLowerCase()
        if (val === targetName) {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' })
          flashSavedStrong(card)
          break
        }
      }
    })
  })
}



// start up this editor module
function EDIT_start() {
  EDIT_wireButtons()
  EDIT_listenSelection()
  EDIT_listenProgramSelected()
}



// run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', EDIT_start)
} else {
  EDIT_start()
}
