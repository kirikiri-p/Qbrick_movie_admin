// 画面下に出て自動で消えるトースト通知。
// 保存成功などの軽い通知に使い、alertのように作業を中断させない。
let container = null;

export function showToast(message) {
  if (!container || !document.body.contains(container)) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 600); // transitionendが来ない場合の保険
  }, 2200);
}
