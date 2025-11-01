/* cards.js - click to select a card and keep layout tidy */

/* Get all cards inside the main grid */
function getCardElements() {
  return document.querySelectorAll('.cards-grid .card');
}

/* Mark a card as active and ask layout to refit if available */
function setActiveCard(clickedCard) {
  const cardElements = getCardElements();
  cardElements.forEach((cardElement) => cardElement.classList.remove('active'));
  clickedCard.classList.add('active');

  if (typeof fitCardsTwoRows === 'function') {
    fitCardsTwoRows();
  }
}

/* Start card behavior */
function initCards() {
  const cardElements = getCardElements();
  if (!cardElements.length) return;

  cardElements.forEach((cardElement) => {
    cardElement.addEventListener('click', () => {
      setActiveCard(cardElement);
    });
  });
}

/* Start when ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCards);
} else {
  initCards();
}
