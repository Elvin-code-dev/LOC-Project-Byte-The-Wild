/* ============================================================================
   schedule.js
   Program Assessment Schedule Page

   - Loads divisions, academic years, and schedule rows from backend
   - Renders a grid of checkboxes (program × year)
   - Allows adding/removing years
   - Allows selecting programs for the current academic year
   - Previous years are locked based on toggle
   ============================================================================ */


/* ============================================================================
   Global state
   ============================================================================ */
let SCHED_DIVISIONS = []
let SCHED_YEARS = []
let SCHED_ROWS = []
let SCHED_CURRENT_YEAR_ID = null
let SCHED_LOCK_PREVIOUS = true   // true = only current year can be changed


/* ============================================================================
   Fetch JSON helper with safe error handling
   ============================================================================ */
async function schedFetchJson(url, options) {
  const res = await fetch(url, options || {})
  let text = ''

  try { text = await res.text() } catch (_) {}

  if (!res.ok) {
    let data
    try { data = JSON.parse(text) } catch (_) { data = null }
    throw new Error((data && data.error) || 'server error')
  }

  try {
    return text ? JSON.parse(text) : null
  } catch (_) {
    return null
  }
}


/* ============================================================================
   MODAL SYSTEM (blurred-background modal for messages / input)
   ============================================================================ */
let schedModalBackdrop = null
let schedModalBox = null
let schedModalTitle = null
let schedModalBody = null
let schedModalInput = null
let schedModalConfirmBtn = null
let schedModalCancelBtn = null
let schedModalConfig = null

// Create modal DOM elements once
function schedEnsureModal() {
  if (schedModalBackdrop) return

  schedModalBackdrop = document.createElement('div')
  schedModalBackdrop.className = 'schedule-modal-backdrop'

  schedModalBackdrop.innerHTML = `
    <div class="schedule-modal">
      <h3 class="schedule-modal__title"></h3>
      <p class="schedule-modal__body"></p>
      <input class="schedule-modal__input" type="text" />
      <div class="schedule-modal__buttons">
        <button type="button" class="btn btn-ghost schedule-modal__cancel">Cancel</button>
        <button type="button" class="btn btn-primary schedule-modal__confirm">OK</button>
      </div>
    </div>
  `

  document.body.appendChild(schedModalBackdrop)

  schedModalBox = schedModalBackdrop.querySelector('.schedule-modal')
  schedModalTitle = schedModalBackdrop.querySelector('.schedule-modal__title')
  schedModalBody = schedModalBackdrop.querySelector('.schedule-modal__body')
  schedModalInput = schedModalBackdrop.querySelector('.schedule-modal__input')
  schedModalConfirmBtn = schedModalBackdrop.querySelector('.schedule-modal__confirm')
  schedModalCancelBtn = schedModalBackdrop.querySelector('.schedule-modal__cancel')

  // clicking outside = close
  schedModalBackdrop.addEventListener('click', evt => {
    if (evt.target === schedModalBackdrop) schedCloseModal(false)
  })

  schedModalCancelBtn.addEventListener('click', () => schedCloseModal(false))
  schedModalConfirmBtn.addEventListener('click', () => schedCloseModal(true))
}

// Open modal with config
function schedOpenModal(config) {
  schedEnsureModal()
  schedModalConfig = config || {}

  schedModalTitle.textContent = schedModalConfig.title || ''
  schedModalBody.textContent = schedModalConfig.message || ''

  const showInput = !!schedModalConfig.showInput
  schedModalInput.style.display = showInput ? 'block' : 'none'
  schedModalInput.value = schedModalConfig.initialValue || ''
  schedModalInput.placeholder = schedModalConfig.placeholder || ''

  schedModalConfirmBtn.textContent = schedModalConfig.confirmLabel || 'OK'
  schedModalCancelBtn.textContent = schedModalConfig.cancelLabel || 'Cancel'

  schedModalBackdrop.classList.add('schedule-modal--open')

  // focus logic
  if (showInput) {
    schedModalInput.focus()
    schedModalInput.select()
  } else {
    schedModalConfirmBtn.focus()
  }
}

// Close modal and run callbacks
function schedCloseModal(confirmed) {
  if (!schedModalBackdrop) return

  schedModalBackdrop.classList.remove('schedule-modal--open')

  const cfg = schedModalConfig || {}
  schedModalConfig = null

  if (confirmed) {
    const value =
      schedModalInput && schedModalInput.style.display !== 'none'
        ? schedModalInput.value.trim()
        : null
    if (cfg.onConfirm) cfg.onConfirm(value)
  } else {
    if (cfg.onCancel) cfg.onCancel()
  }
}


/* ============================================================================
   Schedule data helpers
   ============================================================================ */

// Convert schedule rows → map[yearId][programId] = is_selected
function buildScheduleMap(rows) {
  const map = {}
  rows.forEach(row => {
    const y = row.academic_year_id
    const p = row.program_id
    if (!y || !p) return

    if (!map[y]) map[y] = {}
    map[y][p] = row.is_selected === 1 || row.is_selected === true
  })
  return map
}

// Return the academic year currently flagged as "current"
function findCurrentYear() {
  const years = SCHED_YEARS || []
  return years.find(y => y.is_current === 1 || y.is_current === true) || null
}

// Update global current-year-ID
function updateCurrentYearId() {
  const cur = findCurrentYear()
  SCHED_CURRENT_YEAR_ID = cur ? cur.id : null
}


/* ============================================================================
   Rendering the main schedule table
   ============================================================================ */
function renderSchedule() {
  const headerRow = document.getElementById('schedule-header-row')
  const tbody = document.getElementById('schedule-tbody')
  if (!headerRow || !tbody) return

  updateCurrentYearId()

  // Sort years by start date → then ID
  const years = [...(SCHED_YEARS || [])]
  years.sort((a, b) => {
    if (a.start_date && b.start_date && a.start_date !== b.start_date) {
      return a.start_date < b.start_date ? -1 : 1
    }
    return a.id - b.id
  })

  const divisions = SCHED_DIVISIONS || []
  const scheduleMap = buildScheduleMap(SCHED_ROWS || [])

  /* ------------------------------------------------------------
     HEADER ROW (year labels)
     ------------------------------------------------------------ */
  headerRow.innerHTML =
    '<th class="sticky-col">Division / Program</th>' +
    years
      .map(y => {
        const isCurrent = y.id === SCHED_CURRENT_YEAR_ID
        const cls = [
          isCurrent ? 'schedule-year-current' : '',
          SCHED_LOCK_PREVIOUS && !isCurrent ? 'schedule-year-locked' : ''
        ]
          .filter(Boolean)
          .join(' ')

        return `<th class="${cls}">${y.label}${isCurrent ? ' (current)' : ''}</th>`
      })
      .join('')

  tbody.innerHTML = ''


  /* ------------------------------------------------------------
     DIVISION + PROGRAM ROWS
     ------------------------------------------------------------ */
  divisions.forEach(division => {
    const programs = Array.isArray(division.programList)
      ? division.programList
      : []

    // Division row
    const divRow = document.createElement('tr')
    divRow.className = 'schedule-division-row'

    const divCell = document.createElement('td')
    divCell.colSpan = years.length + 1
    divCell.textContent = division.divisionName || ''
    divRow.appendChild(divCell)
    tbody.appendChild(divRow)

    // Program rows
    programs.forEach(program => {
      const rowEl = document.createElement('tr')

      const labelCell = document.createElement('td')
      labelCell.className = 'schedule-program-cell'
      labelCell.textContent = program.programName || program.name || ''
      rowEl.appendChild(labelCell)

      const programId = program.id

      // One checkbox per year
      years.forEach(year => {
        const td = document.createElement('td')
        td.className = 'schedule-year-cell'

        const cb = document.createElement('input')
        cb.type = 'checkbox'
        cb.dataset.yearId = String(year.id)
        cb.dataset.programId = String(programId)

        const checked =
          !!programId &&
          !!scheduleMap[year.id] &&
          !!scheduleMap[year.id][programId]

        cb.checked = checked

        const isCurrent = year.id === SCHED_CURRENT_YEAR_ID

        // lock any past year
        if (SCHED_LOCK_PREVIOUS && !isCurrent) cb.disabled = true

        // save when toggled
        cb.addEventListener('change', async () => {
          if (!programId || !year.id) return

          program.improvementSelected = cb.checked;

          const payload = {
            academic_year_id: year.id,
            program_id: programId,
            is_selected: cb.checked
          }

          try {
            const res = await fetch('/api/schedule', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            })
            if (!res.ok) throw new Error('schedule save failed')

            const saved = await res.json()

            // update cache
            const idx = SCHED_ROWS.findIndex(
              r =>
                r.academic_year_id === saved.academic_year_id &&
                r.program_id === saved.program_id
            )
            if (idx === -1) {
              SCHED_ROWS.push(saved)
            } else {
              SCHED_ROWS[idx] = { ...SCHED_ROWS[idx], ...saved }
            }

          } catch (err) {
            console.error('schedule update failed', err)
            cb.checked = !cb.checked

            schedOpenModal({
              title: 'Save problem',
              message: 'Could not update schedule. Please try again.',
              confirmLabel: 'OK',
              cancelLabel: 'Close'
            })
          }
        })

        td.appendChild(cb)
        rowEl.appendChild(td)
      })

      tbody.appendChild(rowEl)
    })
  })

  updateLockButtonLabel()
}


/* ============================================================================
   Toggle “lock previous years” button
   ============================================================================ */
let lockToggleBtn = null

function updateLockButtonLabel() {
  if (!lockToggleBtn) lockToggleBtn = document.getElementById('lock-prev-years-btn')
  if (!lockToggleBtn) return

  lockToggleBtn.textContent = SCHED_LOCK_PREVIOUS
    ? 'Unlock previous years'
    : '   Lock previous years'
}


/* ============================================================================
   Page Initialization
   ============================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  const addYearBtn = document.getElementById('add-year-btn')
  const removeYearBtn = document.getElementById('remove-year-btn')
  lockToggleBtn = document.getElementById('lock-prev-years-btn')

  /* ------------------------------------------------------------
     INITIAL LOAD (divisions + years + schedule rows)
     ------------------------------------------------------------ */
  try {
    const [divisions, years, scheduleRows] = await Promise.all([
      schedFetchJson('/api/divisions', { cache: 'no-store' }),
      schedFetchJson('/api/years', { cache: 'no-store' }),
      schedFetchJson('/api/schedule', { cache: 'no-store' })
    ])

    SCHED_DIVISIONS = divisions || []
    SCHED_YEARS = years || []
    SCHED_ROWS = scheduleRows || []

    renderSchedule()

  } catch (err) {
    console.error('Schedule init failed', err)

    schedOpenModal({
      title: 'Load problem',
      message: 'Could not load schedule data from the server.',
      confirmLabel: 'OK',
      cancelLabel: 'Close'
    })
  }


  /* ------------------------------------------------------------
     ADD NEW ACADEMIC YEAR
     ------------------------------------------------------------ */
  if (addYearBtn) {
    addYearBtn.addEventListener('click', () => {

      // Suggest next year label
      const years = SCHED_YEARS || []
      const last = years[years.length - 1]
      let suggested = ''

      if (last && last.label) {
        const parts = String(last.label).split('-')
        const first = parseInt(parts[0], 10)
        const second = parseInt(parts[1], 10)
        if (!isNaN(first) && !isNaN(second)) {
          suggested = `${first + 1}-${(second + 1).toString().slice(-2)}`
        }
      }

      schedOpenModal({
        title: 'Add academic year',
        message: 'Enter the new academic year label (for example 2028-29).',
        showInput: true,
        initialValue: suggested,
        placeholder: 'YYYY-YY',
        confirmLabel: 'Add year',
        cancelLabel: 'Cancel',
        onConfirm: async value => {
          const label = (value || '').trim()
          if (!label) return

          // Prevent duplicates
          const exists = (SCHED_YEARS || []).some(
            y => String(y.label).toLowerCase() === label.toLowerCase()
          )
          if (exists) {
            schedOpenModal({
              title: 'Year exists',
              message: 'That academic year already exists.',
              confirmLabel: 'OK',
              cancelLabel: 'Close'
            })
            return
          }

          addYearBtn.disabled = true
          try {
            const newYear = await schedFetchJson('/api/years', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ label })
            })
            SCHED_YEARS.push(newYear)
            renderSchedule()

          } catch (err) {
            console.error('Add year failed', err)
            schedOpenModal({
              title: 'Add year problem',
              message: 'Could not add a new academic year.',
              confirmLabel: 'OK',
              cancelLabel: 'Close'
            })
          } finally {
            addYearBtn.disabled = false
          }
        }
      })
    })
  }


  /* ------------------------------------------------------------
     REMOVE LAST REMOVABLE YEAR
     ------------------------------------------------------------ */
  if (removeYearBtn) {
    removeYearBtn.addEventListener('click', () => {
      const removable = (SCHED_YEARS || [])
        .filter(y => !(y.is_current === 1 || y.is_current === true))

      if (!removable.length) {
        schedOpenModal({
          title: 'Nothing to remove',
          message: 'There are no removable years. You cannot delete the current year.',
          confirmLabel: 'OK',
          cancelLabel: 'Close'
        })
        return
      }

      const last = removable[removable.length - 1]

      schedOpenModal({
        title: 'Remove academic year',
        message: `Remove "${last.label}" and all selections for that year?`,
        confirmLabel: 'Remove',
        cancelLabel: 'Cancel',
        onConfirm: async () => {
          removeYearBtn.disabled = true
          try {
            const res = await fetch(`/api/years/${last.id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('delete failed')

            // remove from memory
            SCHED_YEARS = SCHED_YEARS.filter(y => y.id !== last.id)
            SCHED_ROWS = SCHED_ROWS.filter(r => r.academic_year_id !== last.id)

            renderSchedule()

          } catch (err) {
            console.error('remove year failed', err)
            schedOpenModal({
              title: 'Remove problem',
              message: 'Could not remove that academic year.',
              confirmLabel: 'OK',
              cancelLabel: 'Close'
            })
          } finally {
            removeYearBtn.disabled = false
          }
        }
      })
    })
  }


  /* ------------------------------------------------------------
     LOCK / UNLOCK PREVIOUS YEARS
     ------------------------------------------------------------ */
  if (lockToggleBtn) {
    lockToggleBtn.addEventListener('click', () => {
      SCHED_LOCK_PREVIOUS = !SCHED_LOCK_PREVIOUS
      renderSchedule()
    })
  }
})
