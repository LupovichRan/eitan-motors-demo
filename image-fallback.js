// Keep an unavailable external photo from leaving an empty/broken card.
document.addEventListener('error', event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || image.dataset.fallbackUsed) return;
  image.dataset.fallbackUsed = 'true';
  image.src = 'placeholder.svg';
  image.alt = 'תמונת הרכב אינה זמינה — איור להמחשה';
}, true);
