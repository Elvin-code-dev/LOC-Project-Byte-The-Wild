// edit.js handles the division editor 
// it loads division data, merges local drafts, validates fields, and saves to the database
// had allot of help from ai and google to make this work

// small settings for autosave
const EDIT_DEBOUNCE_MS = 700
let EDIT_divisionsCache = null
let EDIT_autosaveTimer = null
let EDIT_dirty = false  // tracks if there are unsaved changes
let EDIT_currentYear = null
let EDIT_currentSchedule = null  


// wait a short time before autosaving after a change needed to add this 
function debounceSave(fn) {
  clearTimeout(EDIT_autosaveTimer)
  EDIT_autosaveTimer = setTimeout(fn, EDIT_DEBOUNCE_MS)
}

// show an info modal message (or alert fallback bascilly )  
function EDIT_showInfo(title, message) {
  if (window.LOC_HUD && typeof window.LOC_HUD.openModal === 'function') {
    window.LOC_HUD.openModal({
      title,
      message,
      confirmLabel: 'OK',
      cancelLabel: 'Close'
    })
  } else {
    alert(message)
  }
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
  if (!local) return base;

  const m = { ...base };

  if (local.divisionName) m.divisionName = local.divisionName;
  if (local.dean) m.deanName = local.dean;
  if (local.chair) m.chairName = local.chair;
  if (local.pen) m.penContact = local.pen;
  if (local.loc) m.locRep = local.loc;
  if (local.notes) m.notes = local.notes;

  // merge program list carefully so we KEEP ids from the DB
  if (Array.isArray(local.programsData)) {
    const baseList = Array.isArray(base.programList) ? base.programList : [];
    const byName = new Map();

    baseList.forEach(bp => {
      const key = (bp.programName || '').trim().toLowerCase();
      if (!key) return;
      if (!byName.has(key)) byName.set(key, bp);
    });

    const merged = [];

    local.programsData.forEach(lp => {
      const key = (lp.programName || '').trim().toLowerCase();
      const match = key && byName.get(key);

      if (match) {
        merged.push({
          ...match,
          ...lp,
          id: match.id          
        });
        byName.delete(key);
      } else {
        merged.push(lp);         
      }
    });

    // any DB programs that didnt have a local override
    byName.forEach(bp => merged.push(bp));

    m.programList = merged;
  }

  return m;
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

async function EDIT_loadCurrentYear() {
  try {
    const r = await fetch('/api/years')
    if (!r.ok) return
    const years = await r.json()
    EDIT_currentYear = years.find(
      y => y.is_current === 1 || y.is_current === true
    ) || null
  } catch (err) {
    console.error('EDIT_loadCurrentYear error', err)
  }
}

async function EDIT_loadCurrentSchedule() {
  if (!EDIT_currentYear) {
    EDIT_currentSchedule = null
    return
  }
  try {
    const r = await fetch(`/api/schedule?yearId=${EDIT_currentYear.id}`)
    if (!r.ok) throw 0
    const rows = await r.json()
    const map = {}
    rows.forEach(row => {
      if ((row.is_selected === 1 || row.is_selected === true) && row.program_id) {
        map[row.program_id] = true
      }
    })
    EDIT_currentSchedule = map
  } catch (err) {
    console.error('EDIT_loadCurrentSchedule error', err)
    EDIT_currentSchedule = null
  }
}

async function EDIT_toggleProgramSelected(programId, isSelected) {
  if (!EDIT_currentYear) return
  try {
    const r = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        academic_year_id: EDIT_currentYear.id,
        program_id: programId,
        is_selected: !!isSelected
      })
    })
    if (!r.ok) throw 0
    const row = await r.json()
    if (!EDIT_currentSchedule) EDIT_currentSchedule = {}
    EDIT_currentSchedule[programId] = !!row.is_selected
  } catch (err) {
    console.error('EDIT_toggleProgramSelected error', err)
    EDIT_showInfo('Save problem', 'Could not update selected status.')
  }
}


// build the programs and payees editor inside the division editor
function EDIT_renderProgramsEditor(divRec) {
  const { programsMount } = EDIT_els();
  if (!programsMount) return;

  // helper so we always mark dirty + autosave safely
  const markDirtyAndAutosave = () => {
    EDIT_dirty = true;
    if (typeof EDIT_autosaveDraft === 'function') {
      debounceSave(() => EDIT_autosaveDraft());
    }
  };

  // clear old stuff
  programsMount.innerHTML = '';

  // remove any duplicate headers and add a single Programs & Payees header
  const parent = programsMount.parentElement;
  if (parent) {
    parent.querySelectorAll('.programs-header').forEach(h => h.remove());

    const header = document.createElement('h3');
    header.textContent = 'Programs & Payees';
    header.className = 'section-title programs-header';
    parent.insertBefore(header, programsMount);
  }

  // top bar with Add Program button aligned to the right
  const topBar = document.createElement('div');
  topBar.className = 'programs-topbar';

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn btn-primary add-program-btn';
  addBtn.textContent = 'Add Program';

  addBtn.addEventListener('click', () => {
    divRec.programList = Array.isArray(divRec.programList)
      ? divRec.programList
      : [];

    divRec.programList.push({
      programName: 'New Program',
      payees: [],
      hasBeenPaid: false,
      reportSubmitted: false,
      notes: ''
    });

    markDirtyAndAutosave();

    // re-render and then scroll to the new card
    EDIT_renderProgramsEditor(divRec);

    requestAnimationFrame(() => {
      const cards = programsMount.querySelectorAll('.card');
      if (cards.length) {
        const last = cards[cards.length - 1];
        last.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  topBar.appendChild(addBtn);
  programsMount.appendChild(topBar);

  // start from the divisions program list
  const list = Array.isArray(divRec.programList) ? [...divRec.programList] : [];

  // selected current-year marked for improvement programs first, then A–Z
  list.sort((a, b) => {
    const aSel = a.id && EDIT_currentSchedule && EDIT_currentSchedule[a.id];
    const bSel = b.id && EDIT_currentSchedule && EDIT_currentSchedule[b.id];

    if (aSel && !bSel) return -1;
    if (!aSel && bSel) return 1;

    const aName = (a.programName || '').toLowerCase();
    const bName = (b.programName || '').toLowerCase();
    return aName.localeCompare(bName);
  });

  // build a card for each program
  list.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginBottom = '12px';

    const title = document.createElement('div');
    title.style.fontWeight = '700';
    title.style.marginBottom = '6px';
    title.textContent = `Program ${idx + 1}: ${p.programName || ''}`;
    card.appendChild(title);

    // badge that only shows when marked for improvement
    const badge = document.createElement('span');
    badge.className = 'program-improvement-badge';
    badge.textContent = 'MARKED FOR IMPROVEMENT';
    title.appendChild(badge);

    const progId = p.id;
    const isSelected =
      progId && EDIT_currentSchedule && EDIT_currentSchedule[progId];

    if (isSelected) {
      card.classList.add('improvement-selected');
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }

    // program name
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = p.programName || '';
    nameInput.placeholder = 'Program name';
    nameInput.setAttribute('data-field', 'programName')

    nameInput.addEventListener('input', () => {
      p.programName = nameInput.value;
      markDirtyAndAutosave();
    });

    // payees textarea
    const payeesBox = document.createElement('textarea');
    payeesBox.rows = 3;
    payeesBox.placeholder = 'Payees (one per line: Name - Amount)';
    payeesBox.setAttribute('data-field', 'payees')
    payeesBox.value = (p.payees || [])
      .map(pe => `${pe.name || ''} - ${pe.amount ?? ''}`)
      .join('\n');

    payeesBox.addEventListener('input', () => {
      const rawLines = payeesBox.value
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

      p.payees = rawLines.map(line => {
        const [nm, amtRaw] = line.split('-').map(s => (s || '').trim());
        const amt = Number(amtRaw);
        return { name: nm, amount: Number.isFinite(amt) ? amt : 0 };
      });

      markDirtyAndAutosave();
    });

    // row with checkboxes
    const row = document.createElement('div');
    row.className = 'inline-row';

    // Has been paid
    const paid = document.createElement('label');
    paid.className = 'check';
    const paidCb = document.createElement('input');
    paidCb.type = 'checkbox';
    paidCb.checked = !!p.hasBeenPaid;
    paidCb.setAttribute('data-field', 'hasBeenPaid')
    paidCb.addEventListener('change', () => {
      p.hasBeenPaid = paidCb.checked;
      markDirtyAndAutosave();
    });
    paid.appendChild(paidCb);
    paid.appendChild(document.createTextNode('Has been paid'));

    // Report submitted
    const report = document.createElement('label');
    report.className = 'check';
    const reportCb = document.createElement('input');
    reportCb.type = 'checkbox';
    reportCb.checked = !!p.reportSubmitted;
    reportCb.setAttribute('data-field', 'reportSubmitted')
    reportCb.addEventListener('change', () => {
      p.reportSubmitted = reportCb.checked;
      markDirtyAndAutosave();
    });
    report.appendChild(reportCb);
    report.appendChild(document.createTextNode('Report submitted'));

    // Marked for improvement current year
    const sel = document.createElement('label');
    sel.className = 'check';
    const selCb = document.createElement('input');
    selCb.type = 'checkbox';
    selCb.checked = !!isSelected;

    sel.appendChild(selCb);
    sel.appendChild(document.createTextNode('Marked for improvement'));

    selCb.addEventListener('change', () => {
      if (!progId) {
        EDIT_showInfo(
          'Needs a save',
          'Save this division/program to the database first before marking it for improvement.'
        );
        selCb.checked = false;
        return;
      }
      if (!EDIT_currentYear) {
        EDIT_showInfo(
          'Set current year',
          'No current year is set yet on the Schedule page.'
        );
        selCb.checked = false;
        return;
      }

      EDIT_toggleProgramSelected(progId, selCb.checked);

      if (selCb.checked) {
        card.classList.add('improvement-selected');
        badge.style.display = 'inline-block';
      } else {
        card.classList.remove('improvement-selected');
        badge.style.display = 'none';
      }
    });

    row.appendChild(paid);
    row.appendChild(report);
    row.appendChild(sel);

    // notes
    const notesBox = document.createElement('textarea');
    notesBox.rows = 2;
    notesBox.placeholder = 'Notes';
    notesBox.setAttribute('data-field', 'notes')
    notesBox.value = p.notes || '';
    notesBox.addEventListener('input', () => {
      p.notes = notesBox.value;
      markDirtyAndAutosave();
    });

    // Delete program button
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-danger';
    delBtn.textContent = 'Delete Program';
    delBtn.addEventListener('click', () => {
      const realIndex = divRec.programList.indexOf(p);
      if (realIndex !== -1) {
        divRec.programList.splice(realIndex, 1);
      }
      markDirtyAndAutosave();
      EDIT_renderProgramsEditor(divRec);
    });

    // assemble card
    card.appendChild(EDIT_labelWrap('', nameInput));
    card.appendChild(EDIT_labelWrap('', payeesBox));
    card.appendChild(row);
    card.appendChild(EDIT_labelWrap('Notes', notesBox));
    card.appendChild(delBtn);

    programsMount.appendChild(card);
  });
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

// start up this editor module
async function EDIT_start() {
  EDIT_wireButtons()
  EDIT_listenSelection()
  await EDIT_loadCurrentYear()
  await EDIT_loadCurrentSchedule()
}

// run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    EDIT_start().catch(err => console.error(err))
  })
} else {
  EDIT_start().catch(err => console.error(err))
}
