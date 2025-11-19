// view-archives.js controls the bottom archives drawer
// it loads archive summary data and shows or hides the drawer when clicked

function getArchivesElements() {
  return {
    archivesSection: document.getElementById('archives-section'),
    archivesToggleButton: document.getElementById('archives-toggle'),
    archivesBody: document.getElementById('archives-body'),
    archivesTbody: document.getElementById('archives-tbody')
  }
}

// show or hide the archives drawer
function toggleArchivesSection() {
  const { archivesSection, archivesToggleButton } = getArchivesElements()
  if (!archivesSection || !archivesToggleButton) return

  const isCollapsed = archivesSection.classList.contains('collapsed')

  if (isCollapsed) {
    archivesSection.classList.remove('collapsed')
    archivesToggleButton.textContent = '⮝'
    archivesToggleButton.setAttribute('aria-expanded', 'true')
  } else {
    archivesSection.classList.add('collapsed')
    archivesToggleButton.textContent = '⮟'
    archivesToggleButton.setAttribute('aria-expanded', 'false')
  }
}

// fill the table with archive summary data
function renderArchivesSummary(items) {
  const { archivesTbody } = getArchivesElements()
  if (!archivesTbody) return

  if (!items || !items.length) {
    archivesTbody.innerHTML = `
      <tr>
        <td colspan="6">No archive data yet. Try saving some divisions first.</td>
      </tr>
    `
    return
  }

  archivesTbody.innerHTML = items
    .map(item => {
      const year = item.year || ''
      const division = item.divisionName || ''
      const dean = item.dean || ''
      const chair = item.chair || ''
      const changes = item.changes || 0

      return `
        <tr>
          <td>${year}</td>
          <td>${changes}</td>
          <td>${dean}</td>
          <td>${chair}</td>
          <td>${division}</td>
          <td><button class="btn btn-ghost btn-xs" type="button" disabled>View</button></td>
        </tr>
      `
    })
    .join('')
}

// load the archive summary from the backend
async function loadArchivesSummary() {
  const { archivesTbody } = getArchivesElements()

  if (archivesTbody) {
    archivesTbody.innerHTML = `
      <tr>
        <td colspan="6">Loading archives…</td>
      </tr>
    `
  }

  try {
    const res = await fetch('/api/archives/summary', { cache: 'no-store' })
    if (!res.ok) throw new Error('bad status')

    const data = await res.json()
    renderArchivesSummary(data)

  } catch (err) {
    console.error('Failed to load archives summary', err)

    if (archivesTbody) {
      archivesTbody.innerHTML = `
        <tr>
          <td colspan="6">Could not load archives.</td>
        </tr>
      `
    }
  }
}

// set up archives drawer behavior
function initArchives() {
  const { archivesToggleButton } = getArchivesElements()

  if (archivesToggleButton) {
    archivesToggleButton.addEventListener('click', toggleArchivesSection)
  }

  // load data right away so it is ready when user opens drawer
  loadArchivesSummary()

  // allow escape key to close drawer
  const { archivesSection } = getArchivesElements()

  if (archivesSection) {
    document.addEventListener('keydown', event => {
      const isCollapsed = archivesSection.classList.contains('collapsed')

      if (event.key === 'Escape' && !isCollapsed) {
        toggleArchivesSection()
      }
    })
  }
}

// start when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initArchives)
} else {
  initArchives()
}
