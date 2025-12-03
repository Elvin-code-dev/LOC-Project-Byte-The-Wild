// ============================================================================
// view-archives.js
// Controls the Archives drawer at the bottom of the dashboard.
// Also handles the "View" modal that shows detailed yearly history
// for a selected division.
// ============================================================================


// ============================================================================
//  Basic element getters (keeps code cleaner)
// ============================================================================
function getArchivesElements() {
  return {
    archivesSection: document.getElementById('archives-section'),
    archivesToggleButton: document.getElementById('archives-toggle'),
    archivesBody: document.getElementById('archives-body'),
    archivesTbody: document.getElementById('archives-tbody')
  };
}


// ============================================================================
//  Drawer open/close handler
// ============================================================================
function toggleArchivesSection() {
  const { archivesSection, archivesToggleButton } = getArchivesElements();
  if (!archivesSection || !archivesToggleButton) return;

  const isCollapsed = archivesSection.classList.contains('collapsed');

  if (isCollapsed) {
    // expand drawer
    archivesSection.classList.remove('collapsed');
    archivesToggleButton.textContent = '⮝';
    archivesToggleButton.setAttribute('aria-expanded', 'true');
  } else {
    // collapse drawer
    archivesSection.classList.add('collapsed');
    archivesToggleButton.textContent = '⮟';
    archivesToggleButton.setAttribute('aria-expanded', 'false');
  }
}


// ============================================================================
//  Utility: "time ago" labels
// ============================================================================
function archTimeAgo(date) {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;

  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;

  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;

  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}


// ============================================================================
//  Utility: currency formatting for totals
// ============================================================================
function archDollar(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num === 0) return '';
  return num.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });
}


// ============================================================================
//  Convert timestamp > academic year string ( "2023-2024")
// ============================================================================
function archAcademicYear(dateValue) {
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const month = d.getMonth();

  // Academic year starts in July (month 6)
  const startYear = month >= 6 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}


// ============================================================================
//  Build summary of differences between two snapshots
// ============================================================================
function archDiffSummary(prev, curr) {
  const pieces = [];

  // Track simple field changes (dean, chair, pen, loc)
  const fieldLabels = [
    ['dean', 'Dean'],
    ['chair', 'Chair'],
    ['pen', 'Pen contact'],
    ['loc', 'LOC rep']
  ];

  const fieldChanges = [];

  fieldLabels.forEach(([key, label]) => {
    const before = (prev[key] || '').trim();
    const after = (curr[key] || '').trim();
    if (before !== after) fieldChanges.push({ label, before, after });
  });

  // Summarize field changes
  if (fieldChanges.length) {
    const bits = fieldChanges.slice(0, 2).map(c => {
      const from = c.before || '—';
      const to = c.after || '—';
      return `${c.label}: ${from} → ${to}`;
    });

    if (fieldChanges.length > 2) {
      const extra = fieldChanges.length - 2;
      bits.push(`+${extra} more field${extra === 1 ? '' : 's'}`);
    }

    pieces.push('Fields changed: ' + bits.join(' · '));
  }

  // Count changes (programs/payees/funding)
  const progDelta = (curr.programCount || 0) - (prev.programCount || 0);
  const payeeDelta = (curr.payeeCount || 0) - (prev.payeeCount || 0);
  const amountDelta = (curr.totalAmount || 0) - (prev.totalAmount || 0);

  const countBits = [];
  if (progDelta !== 0) countBits.push(`Programs: ${progDelta > 0 ? '+' : ''}${progDelta}`);
  if (payeeDelta !== 0) countBits.push(`Payees: ${payeeDelta > 0 ? '+' : ''}${payeeDelta}`);
  if (amountDelta !== 0) {
    const money = archDollar(Math.abs(amountDelta));
    countBits.push(`Funding: ${amountDelta > 0 ? '+' : '-'}${money}`);
  }

  if (countBits.length) pieces.push(countBits.join(' · '));

  // Note changes
  const prevNotes = (prev.notes || '').trim();
  const currNotes = (curr.notes || '').trim();
  if (prevNotes !== currNotes && currNotes) {
    pieces.push('Notes updated');
  }

  // General fallback
  if (!pieces.length) return 'Changes saved (program details updated)';
  return pieces.join(' · ');
}


// ============================================================================
//  Open archive modal (overlay)
// ============================================================================
function archOpenModal(title, bodyHtml) {
  const overlay = document.createElement('div');
  overlay.className = 'archives-modal-overlay';

  overlay.innerHTML = `
    <div class="archives-modal" role="dialog" aria-modal="true" aria-label="${title}">
      <header class="archives-modal__head">
        <h3>${title}</h3>
        <button type="button" class="archives-modal__close" aria-label="Close">✕</button>
      </header>

      <div class="archives-modal__body">
        ${bodyHtml}
      </div>

      <footer class="archives-modal__foot">
        <button type="button" class="btn btn--ghost archives-modal__close-btn">Close</button>
      </footer>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close helpers
  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  // Click outside > close
  overlay.addEventListener('click', e => {
    if (e.target === overlay) close();
  });

  // Close buttons
  overlay.querySelectorAll('.archives-modal__close, .archives-modal__close-btn')
    .forEach(btn => btn.addEventListener('click', close));

  // Escape key listener
  document.addEventListener('keydown', onKey);
}


// ============================================================================
//  Render list of saves for one division/year inside modal
// ============================================================================
function archRenderHistoryList(items) {
  if (!items.length) {
    return '<p class="archives-modal-empty">No detailed history found for this division and year.</p>';
  }

  // Sort from earliest → latest
  const sorted = items.slice().sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  let prev = null;

  const lis = sorted.map(item => {
    const dt = new Date(item.created_at);

    // Simple date formatting
    const dateLabel = dt.toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });

    const when = archTimeAgo(dt);

    // Build summary line
    let summary;
    if (!prev) {
      // First entry → summary of initial save
      const parts = [];

      if (item.programCount > 0) {
        parts.push(`${item.programCount} program${item.programCount === 1 ? '' : 's'}`);
      }
      if (item.payeeCount > 0) {
        parts.push(`${item.payeeCount} payee${item.payeeCount === 1 ? '' : 's'}`);
      }
      const dollars = archDollar(item.totalAmount);
      if (dollars) parts.push(dollars);

      if (parts.length) summary = 'Initial save · ' + parts.join(' · ');
      else if ((item.notes || '').trim()) summary = 'Initial save · Notes added';
      else summary = 'Initial save for this division';
    } else {
      // Subsequent saves → field diff summary
      summary = archDiffSummary(prev, item);
    }

    // Notes preview (cut long notes)
    const rawNotes = (item.notes || '').trim();
    const notesPreview =
      rawNotes.length > 160 ? rawNotes.slice(0, 157) + '…' : rawNotes;

    prev = item; // move pointer

    return `
      <li class="archives-history-item">
        <div class="ahi-head">
          <span class="ahi-date">${dateLabel}</span>
          <span class="ahi-when">${when}</span>
        </div>

        <div class="ahi-summary">${summary}</div>

        ${
          notesPreview
            ? `<div class="ahi-notes">Notes: ${notesPreview}</div>`
            : ''
        }
      </li>
    `;
  }).join('');

  return `<ul class="archives-history-list">${lis}</ul>`;
}


// ============================================================================
//  Load detailed records for the modal (max 500) and open modal
// ============================================================================
async function handleArchivesViewClick(year, divisionName) {
  try {
    const res = await fetch('/api/submissions?limit=500', { cache: 'no-store' });
    if (!res.ok) throw new Error('bad status');

    const all = await res.json();

    // Filter down to this division + academic year
    const filtered = all.filter(item => {
      const itemYear = archAcademicYear(item.created_at);
      return itemYear === year && (item.divisionName || '') === divisionName;
    });

    const bodyHtml = archRenderHistoryList(filtered);
    archOpenModal(`${divisionName} — ${year} history`, bodyHtml);

  } catch (err) {
    console.error('Error loading archive details', err);

    archOpenModal(
      'Archive error',
      '<p class="archives-modal-empty">Could not load archive details.</p>'
    );
  }
}


// ============================================================================
//  Attach handlers to each "View" button in the summary table
// ============================================================================
function attachArchivesViewHandlers() {
  const { archivesTbody } = getArchivesElements();
  if (!archivesTbody) return;

  archivesTbody.querySelectorAll('.archives-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const year = btn.getAttribute('data-year');
      const division = btn.getAttribute('data-division');
      if (!year || !division) return;
      handleArchivesViewClick(year, division);
    });
  });
}


// ============================================================================
//  Render summary table rows (bottom drawer table)
// ============================================================================
function renderArchivesSummary(items) {
  const { archivesTbody } = getArchivesElements();
  if (!archivesTbody) return;

  // No data yet
  if (!items || !items.length) {
    archivesTbody.innerHTML = `
      <tr>
        <td colspan="5">No archive data yet. Try saving some divisions first.</td>
      </tr>
    `;
    return;
  }

  archivesTbody.innerHTML = items.map(item => {
    const year = item.year || '';
    const division = item.divisionName || '';
    const who = item.lastEditedBy || '—';  // (placeholder for now until user tracking)
    const changes = item.changes || 0;
    const location = division || '—';

    return `
      <tr>
        <td>${year}</td>
        <td>${changes}</td>
        <td>${who}</td>
        <td>${location}</td>
        <td>
          <button
            class="btn btn--ghost btn-xs archives-view-btn"
            type="button"
            data-year="${year}"
            data-division="${division}"
          >
            View
          </button>
        </td>
      </tr>
    `;
  }).join('');

  attachArchivesViewHandlers();
}


// ============================================================================
//  Fetch summary (top-level archival summary)
// ============================================================================
async function loadArchivesSummary() {
  const { archivesTbody } = getArchivesElements();

  // Show loading row
  if (archivesTbody) {
    archivesTbody.innerHTML = `
      <tr>
        <td colspan="5">Loading archives…</td>
      </tr>
    `;
  }

  try {
    const res = await fetch('/api/archives/summary', { cache: 'no-store' });
    if (!res.ok) throw new Error('bad status');

    const data = await res.json();
    renderArchivesSummary(data);

  } catch (err) {
    console.error('Failed to load archives summary', err);

    if (archivesTbody) {
      archivesTbody.innerHTML = `
        <tr>
          <td colspan="5">Could not load archives.</td>
        </tr>
      `;
    }
  }
}


// ============================================================================
//  INIT: Setup drawer + load data + keyboard close
// ============================================================================
function initArchives() {
  const { archivesToggleButton, archivesSection } = getArchivesElements();

  // Toggle button
  if (archivesToggleButton) {
    archivesToggleButton.addEventListener('click', toggleArchivesSection);
  }

  // Load summary table
  loadArchivesSummary();

  // ESC closes the drawer if open
  if (archivesSection) {
    document.addEventListener('keydown', event => {
      const isCollapsed = archivesSection.classList.contains('collapsed');
      if (event.key === 'Escape' && !isCollapsed) {
        toggleArchivesSection();
      }
    });
  }
}


// ============================================================================
//  Start when ready
// ============================================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initArchives);
} else {
  initArchives();
}
