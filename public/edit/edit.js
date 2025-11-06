// edit.js — inline division editor (programs + people). No page navigation.

// cache for divisions.json
let EDIT_divisionsCache = null;

// load the json once
async function EDIT_getDivisions() {
  if (EDIT_divisionsCache) return EDIT_divisionsCache;
  const res = await fetch('/data/divisions.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('divisions.json not found');
  EDIT_divisionsCache = await res.json();
  return EDIT_divisionsCache;
}

// simple local storage helpers
function EDIT_readLocal() {
  try { return JSON.parse(localStorage.getItem('loc_division_edits_v1') || '{}'); }
  catch { return {}; }
}
function EDIT_writeLocal(obj) {
  localStorage.setItem('loc_division_edits_v1', JSON.stringify(obj || {}));
}

// apply local edits to a division object
function EDIT_mergeDivision(base, localRec) {
  if (!localRec) return base;
  const merged = { ...base };
  if (localRec.divisionName) merged.divisionName = localRec.divisionName;
  if (localRec.dean) merged.deanName = localRec.dean;
  if (localRec.chair) merged.chairName = localRec.chair;
  if (localRec.pen) merged.penContact = localRec.pen;
  if (localRec.loc) merged.locRep = localRec.loc;
  if (localRec.notes) merged.notes = localRec.notes;
  if (Array.isArray(localRec.programsData)) merged.programList = localRec.programsData;
  return merged;
}

// get editor elements
function EDIT_els() {
  return {
    shell: document.getElementById('division-detail'),
    cards: document.getElementById('cards-wrap'),
    finalView: document.getElementById('final-view'),
    badge: document.getElementById('badgeName'),
    idEl: document.getElementById('divisionId'),
    nameEl: document.getElementById('divisionName'),
    deanEl: document.getElementById('deanInput'),
    chairEl: document.getElementById('chairInput'),
    penEl: document.getElementById('penInput'),
    locEl: document.getElementById('locInput'),
    programsEl: document.getElementById('programsInput'),
    notesEl: document.getElementById('notesInput'),
    backBtn: document.getElementById('backToDashboard'),
    resetBtn: document.getElementById('resetEdit'),
    saveBtn: document.getElementById('saveEdit'),
    programsMount: document.getElementById('programsEditor'),
  };
}

// make sure PEN and LOC inputs exist
function EDIT_ensurePeopleFields() {
  const grid = document.querySelector('#division-detail .edit-grid');
  if (!grid) return;

  const makeField = (id, label, placeholder) => {
    const wrap = document.createElement('div');
    wrap.className = 'edit-field';
    const l = document.createElement('label'); l.htmlFor = id; l.textContent = label;
    const i = document.createElement('input'); i.id = id; i.type = 'text'; i.placeholder = placeholder;
    wrap.appendChild(l); wrap.appendChild(i);
    return wrap;
  };

  if (!document.getElementById('penInput')) {
    grid.appendChild(makeField('penInput', 'PEN Contact', 'PEN contact name'));
  }
  if (!document.getElementById('locInput')) {
    grid.appendChild(makeField('locInput', 'LOC Rep', 'LOC representative'));
  }
}

// show editor and hide cards/final
function EDIT_showEditor() {
  const { shell, cards, finalView } = EDIT_els();
  if (cards) cards.classList.add('hidden');
  if (finalView) finalView.style.display = 'none';
  if (shell) {
    shell.style.display = 'block';
    window.scrollTo({ top: shell.offsetTop - 10, behavior: 'smooth' });
  }
}

// go back to cards
function EDIT_backToCards() {
  const { shell, cards } = EDIT_els();
  if (shell) shell.style.display = 'none';
  if (cards) cards.classList.remove('hidden');
}

// toast message
function EDIT_toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast ok';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(EDIT_toast._t);
  EDIT_toast._t = setTimeout(() => (t.style.display = 'none'), 1500);
}

// build a labeled wrapper
function EDIT_labelWrap(text, el, full = true) {
  const w = document.createElement('div');
  w.className = `edit-field ${full ? 'full' : ''}`;
  if (text) {
    const l = document.createElement('label');
    l.textContent = text;
    w.appendChild(l);
  }
  w.appendChild(el);
  return w;
}

// render the Programs & Payees editor for a division record
function EDIT_renderProgramsEditor(divRec) {
  const { programsMount } = EDIT_els();
  programsMount.innerHTML = '';

  const list = Array.isArray(divRec?.programList) ? divRec.programList : [];

  const wrap = document.createElement('div');

  // add button row
  const topBar = document.createElement('div');
  topBar.className = 'toolbar';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-ghost';
  addBtn.textContent = 'Add Program';
  addBtn.addEventListener('click', () => {
    divRec.programList = divRec.programList || [];
    divRec.programList.push({
      programName: 'New Program',
      payees: [],
      hasBeenPaid: false,
      reportSubmitted: false,
      notes: ''
    });
    EDIT_renderProgramsEditor(divRec);
  });
  topBar.appendChild(addBtn);
  programsMount.appendChild(topBar);

  list.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginBottom = '12px';

    const title = document.createElement('div');
    title.style.fontWeight = '700';
    title.style.marginBottom = '6px';
    title.textContent = `Program ${idx + 1}: ${p.programName || ''}`;
    card.appendChild(title);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = p.programName || '';
    nameInput.placeholder = 'Program name';
    nameInput.dataset.field = 'programName';

    const payeesBox = document.createElement('textarea');
    payeesBox.rows = 3;
    payeesBox.placeholder = 'Payees (one per line: Name - Amount)';
    payeesBox.value = (p.payees || []).map(pe => `${pe.name || ''} - ${pe.amount ?? ''}`).join('\n');
    payeesBox.dataset.field = 'payees';

    const row = document.createElement('div');
    row.className = 'inline-row';

    const paid = document.createElement('label');
    paid.className = 'check';
    const paidCb = document.createElement('input');
    paidCb.type = 'checkbox';
    paidCb.checked = !!p.hasBeenPaid;
    paidCb.dataset.field = 'hasBeenPaid';
    paid.appendChild(paidCb);
    paid.appendChild(document.createTextNode('Has been paid'));

    const report = document.createElement('label');
    report.className = 'check';
    const reportCb = document.createElement('input');
    reportCb.type = 'checkbox';
    reportCb.checked = !!p.reportSubmitted;
    reportCb.dataset.field = 'reportSubmitted';
    report.appendChild(reportCb);
    report.appendChild(document.createTextNode('Report submitted'));

    // per-program delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger';
    delBtn.textContent = 'Delete Program';
    delBtn.addEventListener('click', () => {
      divRec.programList.splice(idx, 1);
      EDIT_renderProgramsEditor(divRec);
    });

    row.appendChild(paid);
    row.appendChild(report);
    row.appendChild(delBtn);

    const notes = document.createElement('textarea');
    notes.rows = 2;
    notes.placeholder = 'Notes';
    notes.value = p.notes || '';
    notes.dataset.field = 'notes';

    const grid = document.createElement('div');
    grid.className = 'edit-grid';
    grid.appendChild(EDIT_labelWrap('Program Name', nameInput));
    grid.appendChild(EDIT_labelWrap('Payees', payeesBox));
    grid.appendChild(EDIT_labelWrap('', row));
    grid.appendChild(EDIT_labelWrap('Notes', notes));

    // keep a handle to the original object (optional)
    card._program = p;

    card.appendChild(grid);
    wrap.appendChild(card);
  });

  // save programs (stores to localStorage under the division name key)
  const bottomBar = document.createElement('div');
  bottomBar.className = 'toolbar';
  const saveProgramsBtn = document.createElement('button');
  saveProgramsBtn.className = 'btn btn-primary';
  saveProgramsBtn.textContent = 'Save Programs';
  saveProgramsBtn.addEventListener('click', () => {
    const cards = wrap.querySelectorAll('.card');
    const updated = [];
    cards.forEach((c) => {
      const programName = c.querySelector('[data-field="programName"]').value.trim();
      const payeesText = c.querySelector('[data-field="payees"]').value;
      const hasBeenPaid = c.querySelector('[data-field="hasBeenPaid"]').checked;
      const reportSubmitted = c.querySelector('[data-field="reportSubmitted"]').checked;
      const notes = c.querySelector('[data-field="notes"]').value;

      const payees = payeesText.split('\n').map(line => {
        const [name, amt] = line.split('-').map(s => (s || '').trim());
        if (!name) return null;
        const num = Number(amt);
        return { name, amount: isNaN(num) ? 0 : num };
      }).filter(Boolean);

      updated.push({ programName, payees, hasBeenPaid, reportSubmitted, notes });
    });

    divRec.programList = updated;

    const key = (document.getElementById('divisionName').value || '').trim();
    const store = EDIT_readLocal();
    store[key] = { ...(store[key] || {}), programsData: updated };
    EDIT_writeLocal(store);
    EDIT_toast('Programs saved');
  });

  bottomBar.appendChild(saveProgramsBtn);
  programsMount.appendChild(wrap);
  programsMount.appendChild(bottomBar);
}

// fill the people/overview fields for a division
function EDIT_fillPeople(recId, recName, rec) {
  EDIT_ensurePeopleFields();
  const { badge, idEl, nameEl, deanEl, chairEl, penEl, locEl, programsEl, notesEl } = EDIT_els();

  idEl.value = recId || recName || '';
  nameEl.value = (rec?.divisionName || recName || recId || '').trim();
  deanEl.value = rec?.deanName || '';
  chairEl.value = rec?.chairName || '';
  penEl.value = rec?.penContact || '';
  locEl.value = rec?.locRep || '';
  programsEl.value = Array.isArray(rec?.programList) ? String(rec.programList.length) : '';
  notesEl.value = rec?.notes || '';
  badge.textContent = nameEl.value;
}

// save the people/overview fields into local storage
function EDIT_savePeople() {
  const { nameEl, deanEl, chairEl, penEl, locEl, notesEl } = EDIT_els();
  const key = (nameEl.value || '').trim();
  if (!key) return;

  const store = EDIT_readLocal();
  store[key] = {
    ...(store[key] || {}),
    divisionName: key,
    dean: (deanEl.value || '').trim(),
    chair: (chairEl.value || '').trim(),
    pen: (penEl.value || '').trim(),
    loc: (locEl.value || '').trim(),
    notes: (notesEl.value || '').trim()
  };
  EDIT_writeLocal(store);
  EDIT_toast('Saved');
}

// clear only this division’s local edits
function EDIT_resetCurrent() {
  const { nameEl } = EDIT_els();
  const key = (nameEl.value || '').trim();
  if (!key) return;
  const store = EDIT_readLocal();
  delete store[key];
  EDIT_writeLocal(store);
  EDIT_toast('Cleared local edits for this division');
}

// open editor for a selected division (id/name from cards or left panel)
async function EDIT_openEditor(id, name) {
  const all = await EDIT_getDivisions();
  const store = EDIT_readLocal();

  const key = String(id || name).toLowerCase();
  const base = all.find(d => (d.divisionName || '').toLowerCase() === key) || {
    divisionName: name || id, programList: []
  };
  const merged = EDIT_mergeDivision(base, store[(base.divisionName || '').trim()]);

  EDIT_fillPeople(id, name, merged);
  EDIT_renderProgramsEditor(merged);
  EDIT_showEditor();
}

// wire buttons
function EDIT_wireButtons() {
  const { backBtn, resetBtn, saveBtn } = EDIT_els();
  if (backBtn) backBtn.addEventListener('click', EDIT_backToCards);
  if (resetBtn) resetBtn.addEventListener('click', EDIT_resetCurrent);
  if (saveBtn) saveBtn.addEventListener('click', EDIT_savePeople);
}

// listen for the selection event broadcast by cards.js / left-panel.js
function EDIT_listenSelection() {
  window.addEventListener('division:selected', (e) => {
    const { id, name } = e.detail || {};
    if (!id && !name) return;
    EDIT_openEditor(id, name);
  });
}

// boot
function EDIT_start() {
  EDIT_wireButtons();
  EDIT_listenSelection();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', EDIT_start);
} else {
  EDIT_start();
}
