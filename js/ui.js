// أدوات واجهة مشتركة: تهريب نصوص، مودال، توست، حلقة تقدم SVG

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// مودال سفلي؛ يرجع العنصر، والإغلاق بالنقر على الخلفية أو closeModal()
export function openModal(html) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal">${html}</div>`;
  back.addEventListener('click', (e) => {
    if (e.target === back) back.remove();
  });
  document.body.appendChild(back);
  return back;
}

export function closeModal(el) {
  el.closest('.modal-back')?.remove();
}

let toastTimer = null;
export function toast(msg, { action = null, onAction = null, sticky = false } = {}) {
  const box = document.getElementById('toast');
  box.innerHTML = `<div class="msg ${action ? 'action' : ''}">${esc(msg)}${action ? ` — ${esc(action)}` : ''}</div>`;
  if (onAction) box.firstChild.addEventListener('click', onAction);
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(() => { box.innerHTML = ''; }, 3200);
}

// حلقة تقدم SVG
export function ring(pct, size = 74, label = '') {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(Math.max(pct, 0), 1));
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--card2)" stroke-width="8"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--accent)" stroke-width="8"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"
      transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
      font-size="${size / 4.6}" font-weight="700" fill="var(--text)">${esc(label)}</text>
  </svg>`;
}

// شريط تقدم مع علامة «المتوقع الآن»
export function progressBar(pct, expectedPct = null) {
  return `<div class="bar">
    <div class="fill" style="width:${Math.min(pct * 100, 100)}%"></div>
    ${expectedPct != null ? `<div class="marker" style="inset-inline-start:${Math.min(expectedPct * 100, 100)}%"></div>` : ''}
  </div>`;
}
