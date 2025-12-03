/* ============================================================================
   history.js
   Builds the History page table. This page shows all saved submissions
   (snapshots) for every division, including dean/chair changes and payee totals.

   Features:
   • Fetch latest submission records from /api/submissions
   • Format numbers as dollars
   • Format timestamps into readable local time
   • Build table rows dynamically
   • Apply DataTables for scrolling + sorting
   ============================================================================ */


/* ============================================================================
   Format helpers
   ============================================================================ */

/**
 * Convert a number into currency with commas
 * Example: 12000 → $12,000
 */
function dollar(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return ''
  return num.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
}

/**
 * Convert API timestamp → readable date/time
 * Example: 2024-02-01T18:44:11.000Z → "2/1/2024, 10:44 AM"
 */
function formatDate(raw) {
  const date = new Date(raw)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleString()
}


/* ============================================================================
   Build the table body
   ============================================================================ */

/**
 * Given submission rows from the server, create <tr> rows in the table.
 * Uses DataTables if available to add scrolling + sorting.
 */
function buildHistoryTable(submissions) {
  const tbody = document.querySelector('#history-table tbody')
  if (!tbody) return

  tbody.innerHTML = submissions
    .map(item => {
      const savedAt = formatDate(item.created_at)
      const total = dollar(item.totalAmount || 0)

      // Shorten notes so table stays clean
      const rawNotes = item.notes || ''
      const notes =
        rawNotes.length > 120
          ? rawNotes.slice(0, 117) + '...'
          : rawNotes

      return `
        <tr>
          <td>${savedAt}</td>
          <td>${item.divisionName || ''}</td>
          <td>${item.dean || ''}</td>
          <td>${item.chair || ''}</td>
          <td>${item.pen || ''}</td>
          <td>${item.loc || ''}</td>
          <td>${item.programCount || 0}</td>
          <td>${item.payeeCount || 0}</td>
          <td>${total}</td>
          <td>${notes}</td>
        </tr>
      `
    })
    .join('')

  /* If DataTables is available, enhance table behavior */
  if (window.DataTable) {
    // Destroy old instance when user revisits the page
    if (window.__historyTableInstance) {
      window.__historyTableInstance.destroy()
    }

    window.__historyTableInstance = new DataTable('#history-table', {
      destroy: true,         // allow re-init
      autoWidth: false,
      scrollX: true,
      scrollY: '60vh',
      scrollCollapse: true,
      pageLength: 25,
      order: [[0, 'desc']]   // sort newest first
    })
  }
}


/* ============================================================================
   Fetch submissions from server
   ============================================================================ */

async function loadHistory() {
  try {
    const res = await fetch('/api/submissions?limit=200', {
      cache: 'no-store'
    })

    if (!res.ok) throw new Error('Bad server response')

    const data = await res.json()
    buildHistoryTable(data)

  } catch (err) {
    console.error('Failed to load history', err)

    const tbody = document.querySelector('#history-table tbody')
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="10">Could not load history</td></tr>'
    }
  }
}


/* ============================================================================
   Initializer
   ============================================================================ */

function initHistory() {
  loadHistory()
}

/* Run when DOM is ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHistory)
} else {
  initHistory()
}
