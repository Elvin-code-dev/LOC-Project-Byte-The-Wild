// left-panel.js — announce selected division from the left list

function getItems() {
  return document.querySelectorAll('.left-panel .division-list li');
}
function setActive(item) {
  getItems().forEach(li => li.classList.remove('active'));
  item.classList.add('active');
}
function announce(id, name) {
  const detail = { id: String(id || '').trim(), name: String(name || id || '').trim() };
  if (!detail.id) return;
  window.dispatchEvent(new CustomEvent('division:selected', { detail }));
}
function initLeftPanel() {
  getItems().forEach(li => {
    li.addEventListener('click', () => {
      setActive(li);
      const id = li.getAttribute('data-division-id') || li.textContent.trim();
      const name = li.textContent.trim();
      announce(id, name);
    });
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLeftPanel);
} else {
  initLeftPanel();
}
