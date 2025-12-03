/* ============================================================================
   HUD TOOLBOX (hud.js)
   This file controls the floating toolbox for:
   - Adding divisions
   - Deleting divisions
   - Renaming divisions
   - Saving drafts
   It supports dragging, modals, hints, and communicates with:
   - left-panel.js
   - cards.js
   - edit.js
   ============================================================================ */

;(function () {

  /* --------------------------------------------------------------------------
     HUD MODES
     These flags tell us what action the user selected.
     -------------------------------------------------------------------------- */
  const MODES = {
    NONE: null,
    ADD: 'add',
    DELETE: 'delete',
    EDIT: 'edit'
  }

  let currentMode = MODES.NONE
  let isOpen = false

  /* HUD DOM refs (created once) */
  let hudEl = null
  let panelEl = null
  let toggleBtn = null
  let closeBtn = null
  let dragHandle = null
  let hintEl = null
  let modeButtons = {}

  /* Dragging state */
  let isDragging = false
  let dragStartX = 0
  let dragStartY = 0
  let hudStartLeft = 0
  let hudStartTop = 0

  /* Modal DOM refs */
  let modalBackdrop = null
  let modalEl = null
  let modalTitleEl = null
  let modalBodyEl = null
  let modalInputEl = null
  let modalConfirmBtn = null
  let modalCancelBtn = null
  let modalCloseBtn = null
  let modalActiveConfig = null

  /* ==========================================================================
     HUD INITIALIZATION
     Creates the floating HUD box and wires its logic
     ========================================================================== */
  function ensureHud() {
    if (hudEl) return hudEl

    hudEl = document.createElement('div')
    hudEl.id = 'hud-tool'
    hudEl.className = 'hud hud--collapsed'

    /* HUD UI structure */
    hudEl.innerHTML = `
      <div class="hud-inner">
        <button class="hud-toggle" type="button" aria-label="Open tools">⋮</button>

        <div class="hud-panel" aria-label="Dashboard tools">
          <div class="hud-header">
            <span class="hud-title">Tools</span>
            <button class="hud-drag-handle" type="button" aria-label="Drag toolbox">⠿</button>
            <button class="hud-close" type="button" aria-label="Close tools">×</button>
          </div>

          <div class="hud-modes">
            <button class="hud-btn hud-btn--add" data-mode="add" title="Add">+</button>
            <button class="hud-btn hud-btn--delete" data-mode="delete" title="Delete">−</button>
            <button class="hud-btn hud-btn--edit" data-mode="edit" title="Rename">✎</button>
            <button class="hud-btn hud-btn--save" data-mode="save" title="Save">S</button>
          </div>

          <div class="hud-hint">Select a tool to begin</div>
        </div>
      </div>
    `

    document.body.appendChild(hudEl)

    /* Cache elements */
    panelEl = hudEl.querySelector('.hud-panel')
    toggleBtn = hudEl.querySelector('.hud-toggle')
    closeBtn = hudEl.querySelector('.hud-close')
    dragHandle = hudEl.querySelector('.hud-drag-handle')
    hintEl = hudEl.querySelector('.hud-hint')

    /* HUD appears bottom-right */
    hudEl.style.position = 'fixed'
    positionInBottomRight()

    /* Map mode buttons */
    hudEl.querySelectorAll('.hud-btn').forEach(btn => {
      const mode = btn.getAttribute('data-mode')
      if (mode) modeButtons[mode] = btn
    })

    ensureModal()
    wireHudEvents()
    return hudEl
  }

  /* ==========================================================================
     MODAL SYSTEM
     Used for Add / Delete / Rename confirmations
     ========================================================================== */
  function ensureModal() {
    if (modalBackdrop) return

    modalBackdrop = document.createElement('div')
    modalBackdrop.className = 'hud-modal-backdrop'
    modalBackdrop.innerHTML = `
      <div class="hud-modal">
        <div class="hud-modal-header">
          <div class="hud-modal-title"></div>
          <button class="hud-modal-close" type="button" aria-label="Close">×</button>
        </div>

        <div class="hud-modal-body">
          <div class="hud-modal-message"></div>
          <input class="hud-modal-input" type="text" />
        </div>

        <div class="hud-modal-footer">
          <button class="hud-modal-btn hud-modal-btn--cancel">Cancel</button>
          <button class="hud-modal-btn hud-modal-btn--primary">OK</button>
        </div>
      </div>
    `
    document.body.appendChild(modalBackdrop)

    /* Cache modal elements */
    modalEl = modalBackdrop.querySelector('.hud-modal')
    modalTitleEl = modalBackdrop.querySelector('.hud-modal-title')
    modalBodyEl = modalBackdrop.querySelector('.hud-modal-message')
    modalInputEl = modalBackdrop.querySelector('.hud-modal-input')
    modalConfirmBtn = modalBackdrop.querySelector('.hud-modal-btn--primary')
    modalCancelBtn = modalBackdrop.querySelector('.hud-modal-btn--cancel')
    modalCloseBtn = modalBackdrop.querySelector('.hud-modal-close')

    /* Clicking outside closes modal */
    modalBackdrop.addEventListener('click', e => {
      if (e.target === modalBackdrop) closeHudModal(false)
    })

    modalCancelBtn.addEventListener('click', () => closeHudModal(false))
    modalCloseBtn.addEventListener('click', () => closeHudModal(false))
    modalConfirmBtn.addEventListener('click', () => closeHudModal(true))
  }

  function openHudModal(config) {
    modalActiveConfig = config || {}

    modalTitleEl.textContent = config.title || ''
    modalBodyEl.textContent = config.message || ''

    modalInputEl.style.display = config.showInput ? 'block' : 'none'
    if (config.showInput) {
      modalInputEl.value = config.initialValue || ''
      modalInputEl.placeholder = config.placeholder || ''
    }

    modalConfirmBtn.textContent = config.confirmLabel || 'OK'
    modalCancelBtn.textContent = config.cancelLabel || 'Cancel'

    modalBackdrop.style.display = 'flex'
    setTimeout(() =>
      config.showInput ? modalInputEl.focus() : modalConfirmBtn.focus(), 10
    )
  }

  function closeHudModal(confirmed) {
    modalBackdrop.style.display = 'none'

    const cfg = modalActiveConfig
    modalActiveConfig = null
    if (!cfg) return

    if (confirmed) {
      const value = cfg.showInput ? modalInputEl.value.trim() : null
      cfg.onConfirm && cfg.onConfirm(value)
    } else {
      cfg.onCancel && cfg.onCancel()
    }
  }

  /* ==========================================================================
     HUD STATE & POSITION
     ========================================================================== */
  function positionInBottomRight() {
    const pad = 16
    const size = 60
    const vw = window.innerWidth
    const vh = window.innerHeight

    hudEl.style.left = Math.max(pad, vw - size - pad) + 'px'
    hudEl.style.top = Math.max(pad, vh - size - pad) + 'px'
  }

  function setOpen(open) {
    isOpen = open
    hudEl.classList.toggle('hud--open', open)
    hudEl.classList.toggle('hud--collapsed', !open)
    if (!open) clearMode()
  }

  function setHint(text) {
    if (hintEl) hintEl.textContent = text
  }

  function clearMode() {
    const old = currentMode
    currentMode = MODES.NONE

    document.body.classList.remove('hud-mode-add', 'hud-mode-delete', 'hud-mode-edit')
    if (old && modeButtons[old]) modeButtons[old].classList.remove('hud-btn--active')

    setHint('Select a tool to begin')
  }

  /* ==========================================================================
     MODE HANDLING (Add / Delete / Rename)
     ========================================================================== */
  function setMode(modeName) {
    // Save runs instantly, not a mode
    if (modeName === 'save') {
      clearMode()
      saveAtClick()
      return
    }

    let newMode = MODES.NONE
    if (modeName === 'add') newMode = MODES.ADD
    if (modeName === 'delete') newMode = MODES.DELETE
    if (modeName === 'edit') newMode = MODES.EDIT

    // Clicking same button twice = exit mode
    if (currentMode === newMode) {
      clearMode()
      return
    }

    clearMode()
    currentMode = newMode

    if (newMode === MODES.ADD) {
      document.body.classList.add('hud-mode-add')
      setHint('Add mode: click in the left list or cards to add a division')
      modeButtons.add.classList.add('hud-btn--active')
    }

    if (newMode === MODES.DELETE) {
      document.body.classList.add('hud-mode-delete')
      setHint('Delete mode: click a division to delete it')
      modeButtons.delete.classList.add('hud-btn--active')
    }

    if (newMode === MODES.EDIT) {
      document.body.classList.add('hud-mode-edit')
      setHint('Rename mode: click a division name to rename it')
      modeButtons.edit.classList.add('hud-btn--active')
    }
  }

  /* ==========================================================================
     HELPERS TO FIND DIVISION ID WHERE USER CLICKED
     ========================================================================== */
  function getDivisionIdFromTarget(target) {
    const li = target.closest('.left-panel .division-list li')
    if (li) return li.dataset.divisionId || li.textContent.trim()

    const card = target.closest('.cards-grid .card')
    if (card) return card.dataset.divisionId || card.textContent.trim()

    return null
  }

  function getDivisionById(id) {
    if (!window.DIVISIONS) return null
    return window.DIVISIONS.find(d => String(d.id) === String(id))
  }

  /* ==========================================================================
     ACTION: ADD DIVISION
     ========================================================================== */
  function addDivisionAtClick(event) {
    const clickedLeft = !!event.target.closest('.left-panel')
    const clickedCards = !!event.target.closest('#cards-wrap') || !!event.target.closest('.cards-grid')

    if (!clickedLeft && !clickedCards) {
      setHint('Add mode: click the left list or cards area')
      return
    }

    if (!window.DIVISIONS) {
      setHint('Divisions still loading, try again')
      return
    }

    openHudModal({
      title: 'Add new division',
      message: 'Enter a name for the new division.',
      showInput: true,
      placeholder: 'Division name',
      confirmLabel: 'Add',
      cancelLabel: 'Cancel',

      onConfirm: value => {
        if (!value) {
          setHint('Add cancelled')
          clearMode()
          return
        }

        const trimmed = value.trim()

        // Generate new ID
        let maxId = 0
        window.DIVISIONS.forEach(d => {
          const n = parseInt(d.id)
          if (!isNaN(n)) maxId = Math.max(maxId, n)
        })
        const newId = maxId + 1

        const newDiv = {
          id: newId,
          divisionName: trimmed,
          deanName: '',
          penContact: '',
          locRep: '',
          chairName: '',
          programList: []
        }

        window.DIVISIONS = [...window.DIVISIONS, newDiv]

        window.refreshLeftPanel?.(window.DIVISIONS)
        window.renderCards?.(window.DIVISIONS)

        // auto-open editor for new division
        window.dispatchEvent(
          new CustomEvent('division:selected', {
            detail: { id: String(newId), name: trimmed }
          })
        )

        setHint(`Added division: ${trimmed}`)
        clearMode()
      },

      onCancel: () => {
        setHint('Add cancelled')
        clearMode()
      }
    })
  }

  /* ==========================================================================
     ACTION: DELETE DIVISION
     ========================================================================== */
  function deleteDivisionAtClick(event) {
    const id = getDivisionIdFromTarget(event.target)
    if (!id) {
      setHint('Delete mode: click a division')
      return
    }

    const div = getDivisionById(id)
    const name = div?.divisionName || id

    openHudModal({
      title: 'Delete division',
      message: `Delete "${name}" and its programs?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',

      onConfirm: () => {
        window.DIVISIONS = window.DIVISIONS.filter(d => String(d.id) !== String(id))

        window.refreshLeftPanel?.(window.DIVISIONS)
        window.renderCards?.(window.DIVISIONS)

        setHint(`Deleted: ${name}`)
        clearMode()
      },

      onCancel: () => {
        setHint('Delete cancelled')
        clearMode()
      }
    })
  }

  /* ==========================================================================
     ACTION: RENAME DIVISION
     ========================================================================== */
  function renameDivisionAtClick(event) {
    const id = getDivisionIdFromTarget(event.target)
    if (!id) {
      setHint('Rename mode: click a division name')
      return
    }

    const div = getDivisionById(id)
    if (!div) return

    openHudModal({
      title: 'Rename division',
      message: 'Enter a new name for this division.',
      showInput: true,
      initialValue: div.divisionName,
      confirmLabel: 'Rename',
      cancelLabel: 'Cancel',

      onConfirm: value => {
        if (!value) {
          setHint('Rename cancelled')
          clearMode()
          return
        }

        div.divisionName = value.trim()

        window.refreshLeftPanel?.(window.DIVISIONS)
        window.renderCards?.(window.DIVISIONS)

        setHint(`Renamed to: ${div.divisionName}`)
        clearMode()
      },

      onCancel: () => {
        setHint('Rename cancelled')
        clearMode()
      }
    })
  }

  /* ==========================================================================
     ACTION: SAVE BUTTON
     This forces the draft save even if autosave already runs.
     ========================================================================== */
  function saveAtClick() {
    setHint('Saving…')

    let saved = false

    if (window.EDIT_autosaveDraft) {
      try { window.EDIT_autosaveDraft(); saved = true } catch {}
    } else if (window.EDIT_saveDraftToLocal) {
      try { window.EDIT_saveDraftToLocal(); saved = true } catch {}
    }

    setHint(saved ? 'Saved current division' : 'Changes auto-save while typing')
  }

  /* ==========================================================================
     GLOBAL CLICK HANDLER (active when HUD is in a mode)
     Prevents the normal card click and instead triggers the HUD action
     ========================================================================== */
  function onGlobalClick(event) {
    if (!currentMode || currentMode === MODES.NONE) return
    if (!hudEl) return

    // Ignore clicks inside HUD or inside its modal
    if (hudEl.contains(event.target)) return
    if (modalBackdrop?.style.display === 'flex' && modalBackdrop.contains(event.target)) return

    // Prevent normal "open division" click
    event.preventDefault()
    event.stopPropagation()

    if (currentMode === MODES.ADD) addDivisionAtClick(event)
    if (currentMode === MODES.DELETE) deleteDivisionAtClick(event)
    if (currentMode === MODES.EDIT) renameDivisionAtClick(event)
  }

  /* ESC key = exit mode or close modal */
  function onKeyDown(event) {
    if (event.key === 'Escape') {
      if (modalBackdrop?.style.display === 'flex') {
        closeHudModal(false)
      } else {
        clearMode()
      }
    }
  }

  /* ==========================================================================
     DRAGGING THE HUD
     ========================================================================== */
  function startDrag(e) {
    if (e.button !== 0) return
    if (e.pointerType === 'touch') return

    isDragging = true
    hudEl.classList.add('hud--dragging')

    const rect = hudEl.getBoundingClientRect()
    dragStartX = e.clientX
    dragStartY = e.clientY
    hudStartLeft = rect.left
    hudStartTop = rect.top

    window.addEventListener('mousemove', onDragMove)
    window.addEventListener('mouseup', endDrag)
  }

  function onDragMove(e) {
    if (!isDragging) return

    const dx = e.clientX - dragStartX
    const dy = e.clientY - dragStartY

    const newLeft = hudStartLeft + dx
    const newTop = hudStartTop + dy

    const vw = window.innerWidth
    const vh = window.innerHeight
    const pad = 8

    const rect = hudEl.getBoundingClientRect()

    // stop HUD from going off-screen
    const left = Math.min(Math.max(newLeft, pad), vw - rect.width - pad)
    const top = Math.min(Math.max(newTop, pad), vh - rect.height - pad)

    hudEl.style.left = left + 'px'
    hudEl.style.top = top + 'px'
  }

  function endDrag() {
    isDragging = false
    hudEl.classList.remove('hud--dragging')

    window.removeEventListener('mousemove', onDragMove)
    window.removeEventListener('mouseup', endDrag)
  }

  /* ==========================================================================
     WIRE EVENTS
     ========================================================================== */
  function wireHudEvents() {
    toggleBtn.addEventListener('click', () => setOpen(!isOpen))
    closeBtn.addEventListener('click', () => setOpen(false))

    Object.entries(modeButtons).forEach(([name, btn]) => {
      btn.addEventListener('click', () => {
        setOpen(true)
        setMode(name)
      })
    })

    dragHandle.addEventListener('mousedown', startDrag)

    document.addEventListener('click', onGlobalClick, true)
    document.addEventListener('keydown', onKeyDown)

    window.addEventListener('resize', () => {
      if (!isDragging && !hudEl.style.left && !hudEl.style.top) {
        positionInBottomRight()
      }
    })
  }

  /* ==========================================================================
     INIT ON PAGE LOAD
     ========================================================================== */
  function initHud() {
    if (document.body) ensureHud()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHud)
  } else {
    initHud()
  }

  /* ==========================================================================
     PUBLIC API (used by edit.js)
     ========================================================================== */
  window.LOC_HUD = window.LOC_HUD || {}
  window.LOC_HUD.openModal = openHudModal
  window.LOC_HUD.clearMode = clearMode

})()
