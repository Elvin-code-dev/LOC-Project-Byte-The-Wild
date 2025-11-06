// script.js — dashboard wiring (hide/show + robust "View Final" table)

let cacheDivisions = null;
let isFinalVisible = false;

/* ---------------- data helpers ---------------- */

async function loadDivisions() {
  if (cacheDivisions) return cacheDivisions;
  const res = await fetch('/data/divisions.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('divisions.json not found');
  cacheDivisions = await res.json();
  return cacheDivisions;
}

function readLocal() {
  try { return JSON.parse(localStorage.getItem('loc_division_edits_v1') || '{}'); }
  catch { return {}; }
}

function mergeEdits(divs) {
  const store = readLocal();
  return divs.map(d => {
    const key = (d.divisionName || '').trim();
    const rec = store[key];
    if (!rec) return d;
    return {
      ...d,
      divisionName: rec.divisionName || d.divisionName,
      deanName:     rec.dean        ?? d.deanName,
      chairName:    rec.chair       ?? d.chairName,
      penContact:   rec.pen         ?? d.penContact,
      locRep:       rec.loc         ?? d.locRep,
      notes:        rec.notes       ?? d.notes,
      programList: Array.isArray(rec.programsData) ? rec.programsData : d.programList
    };
  });
}

/* ---------------- show / hide ---------------- */

function showCardsOnly() {
  document.getElementById('cards-wrap')?.classList.remove('hidden');
  const ed = document.getElementById('division-detail');
  if (ed) ed.style.display = 'none';
  const fv = document.getElementById('final-view');
  if (fv) fv.style.display = 'none';
  setFinalButton(false);
}

function showFinalOnly() {
  document.getElementById('cards-wrap')?.classList.add('hidden');
  const ed = document.getElementById('division-detail');
  if (ed) ed.style.display = 'none';
  const fv = document.getElementById('final-view');
  if (fv) fv.style.display = 'block';
  window.scrollTo({ top: fv.offsetTop - 10, behavior: 'smooth' });
  setFinalButton(true);
}

function setFinalButton(active) {
  const btn = document.getElementById('view-final-btn');
  isFinalVisible = !!active;
  if (btn) btn.textContent = active ? 'Back to Dashboard' : 'View Final';
}

/* ---------------- final table ---------------- */

function dollar(n) {
  const num = Number(n);
  if (!isFinite(num)) return '';
  return num.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

async function buildFinalTable() {
  const base = await loadDivisions();
  const divisions = mergeEdits(base);

  // read current headers
  const ths = Array.from(document.querySelectorAll('#final-table thead th'));
  const headers = ths.map(th => th.textContent.trim());
  const signature = headers.join('|').toLowerCase();

  const tbody = document.querySelector('#final-table tbody');
  if (!tbody) throw new Error('final-table not found');

  const rows = [];

  if (signature === 'division|dean|chair|pen|loc|program|payees|paid|report|notes') {
    divisions.forEach(d => {
      const list = Array.isArray(d.programList) && d.programList.length ? d.programList : [null];
      list.forEach(p => {
        const payees = p?.payees ? p.payees.map(pe => pe.name).join(', ') : '';
        const paid   = p ? (p.hasBeenPaid ? 'Yes' : 'No') : '';
        const report = p ? (p.reportSubmitted ? 'Yes' : 'No') : '';
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
        ]);
      });
    });
  } else if (signature === 'division|dean|pen|loc|chair|# programs|total payees|total $') {
    divisions.forEach(d => {
      const list = Array.isArray(d.programList) ? d.programList : [];
      const numPrograms = list.length;
      let totalPayees = 0;
      let totalAmount = 0;
      list.forEach(p => {
        const payees = Array.isArray(p?.payees) ? p.payees : [];
        totalPayees += payees.length;
        payees.forEach(pe => { totalAmount += Number(pe.amount) || 0; });
      });
      rows.push([
        d.divisionName || '',
        d.deanName || '',
        d.penContact || '',
        d.locRep || '',
        d.chairName || '',
        String(numPrograms),
        String(totalPayees),
        dollar(totalAmount)
      ]);
    });
  } else if (signature === 'division|dean|chair|program|payees|paid|report|notes') {
    divisions.forEach(d => {
      const list = Array.isArray(d.programList) && d.programList.length ? d.programList : [null];
      list.forEach(p => {
        const payees = p?.payees ? p.payees.map(pe => pe.name).join(', ') : '';
        const paid   = p ? (p.hasBeenPaid ? 'Yes' : 'No') : '';
        const report = p ? (p.reportSubmitted ? 'Yes' : 'No') : '';
        rows.push([
          d.divisionName || '',
          d.deanName || '',
          d.chairName || '',
          p?.programName || '',
          payees,
          paid,
          report,
          p?.notes || d.notes || ''
        ]);
      });
    });
  } else {
    divisions.forEach(d => {
      const list = Array.isArray(d.programList) && d.programList.length ? d.programList : [null];
      list.forEach(p => {
        rows.push([d.divisionName || '', p?.programName || '']);
      });
    });
  }

  // paint tbody to match header count
  const colCount = headers.length;
  tbody.innerHTML = rows.map(r => {
    const cells = [];
    for (let i = 0; i < colCount; i++) cells.push(`<td>${String(r[i] ?? '')}</td>`);
    return `<tr>${cells.join('')}</tr>`;
  }).join('');

  // init DataTable with safe Responsive fallback and scrolling
  const $tbl = $('#final-table');
  const hasResponsive = $.fn.dataTable && $.fn.dataTable.Responsive;

  const opts = {
    destroy: true,
    autoWidth: false,
    scrollX: true,
    scrollY: '55vh',
    scrollCollapse: true,
    pageLength: 25,
    order: [[0, 'asc']].concat(colCount > 5 ? [[5, 'asc']] : [])
  };

  if (hasResponsive) {
    opts.responsive = {
      details: { type: 'inline', target: 'tr' }
    };
  }

  $tbl.DataTable(opts);
}

/* ---------------- events ---------------- */

function onViewFinalClick() {
  if (isFinalVisible) {
    showCardsOnly();
    return;
  }
  buildFinalTable()
    .then(showFinalOnly)
    .catch(err => {
      console.error(err);
      alert('Could not load final data.');
    });
}

function onDivisionSelected() {
  document.getElementById('cards-wrap')?.classList.add('hidden');
  const fv = document.getElementById('final-view');
  if (fv) fv.style.display = 'none';
}

function wire() {
  const btn = document.getElementById('view-final-btn');
  if (btn) btn.addEventListener('click', onViewFinalClick);
  window.addEventListener('division:selected', onDivisionSelected);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wire);
} else {
  wire();
}
