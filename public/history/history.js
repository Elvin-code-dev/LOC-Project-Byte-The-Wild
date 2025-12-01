// history.js builds the history table on the History page
// it loads the last submissions from the server and shows them using DataTables

// format a number as dollars
function dollar(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return ''
  return num.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
}

// turn a raw date string into something readable
function formatDate(d) {
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleString()
}

// build the HTML table rows for the history page
function buildHistoryTable(submissions) {
  const tbody = document.querySelector('#history-table tbody')
  if (!tbody) return

  // create one table row for each submission
  tbody.innerHTML = submissions.map(item => {
    const savedAt = formatDate(item.created_at)
    const total = dollar(item.totalAmount || 0)

    // shorten long notes so the table stays clean
    const notes = (item.notes || '').length > 120
      ? item.notes.slice(0, 117) + '...'
      : (item.notes || '')

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
  }).join('')

  // enhance the table with scrolling and sorting if DataTable is available
  if (window.DataTable) {

    // destroy old table instance if user reloads or returns to the page
    if (window.__historyTableInstance) {
      window.__historyTableInstance.destroy()
    }

    window.__historyTableInstance = new DataTable('#history-table', {
      destroy: true,
      responsive: true,
      autoWidth: false,
      scrollX: true,
      scrollY: '60vh',
      scrollCollapse: true,
      pageLength: 25,
      order: [[0, 'desc']]   // sort by newest first
    })
  }
}

// load submissions from the API
async function loadHistory() {
  try {
    const res = await fetch('/api/submissions?limit=200', { cache: 'no-store' })
    if (!res.ok) throw new Error('bad status')

    const data = await res.json()
    buildHistoryTable(data)

  } catch (err) {
    console.error('Failed to load history', err)

    const tbody = document.querySelector('#history-table tbody')
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="10">Could not load history</td></tr>'
    }
  }
}

// start the history page
function initHistory() {
  loadHistory()
}

// run when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHistory)
} else {
  initHistory()
}
