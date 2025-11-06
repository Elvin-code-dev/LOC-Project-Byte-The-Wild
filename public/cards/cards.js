// /cards/cards.js
// handle clicks on dashboard cards and announce selected division

function getCards() {
  return document.querySelectorAll('.cards-grid .card');
}

function setActiveCard(card) {
  getCards().forEach(c => c.classList.remove('active'));
  card.classList.add('active');
}

function announceSelection(id, name) {
  const detail = { id: String(id || '').trim(), name: String(name || id || '').trim() };
  if (!detail.id) return;
  window.dispatchEvent(new CustomEvent('division:selected', { detail }));
}

function initCards() {
  const cards = getCards();
  if (!cards.length) return;

  cards.forEach(card => {
    card.addEventListener('click', () => {
      setActiveCard(card);
      const id = card.getAttribute('data-division-id') || card.textContent.trim();
      const name = (card.querySelector('.card-title')?.textContent || card.textContent || '').trim();
      announceSelection(id, name);
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCards);
} else {
  initCards();
}
