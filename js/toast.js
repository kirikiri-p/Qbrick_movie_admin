let container = null;

export function showToast(message, options = {}) {
  if (!container || !document.body.contains(container)) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const duration = options.duration || (options.actionLabel ? 6000 : 2200);

  const toast = document.createElement('div');
  toast.className = 'toast';

  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 600);
  };

  if (options.actionLabel && typeof options.onAction === 'function') {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = options.actionLabel;
    btn.addEventListener('click', () => {
      options.onAction();
      remove();
    });
    toast.appendChild(btn);
    toast.style.pointerEvents = 'auto';
  }

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(remove, duration);
}
