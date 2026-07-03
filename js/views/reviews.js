// شاشة المراجعات: سجل المراجعات الأسبوعية والشهرية + معالج المراجعة الشهرية

import { state, update, uid } from '../store.js';
import { todayISO, gregLong, hijriLong } from '../dates.js';
import { esc, openModal, closeModal, toast } from '../ui.js';

const WEEKLY_QS = {
  achieved: 'وش أنجزت وتفخر فيه؟',
  blocked: 'وش تعثر؟ وليش؟',
  adjust: 'وش بتعدل الأسبوع الجاي؟',
};
const MONTHLY_QS = {
  achieved: 'أبرز إنجازات الشهر؟',
  blocked: 'وش تعثر خلال الشهر؟ وليش؟',
  adjust: 'وش بتغير الشهر القادم؟',
  fit: 'هل أهدافك وأورادك ما زالت مناسبة؟ وش يحتاج تعديل؟',
};

function monthlyWizard() {
  const modal = openModal(`
    <h2>المراجعة الشهرية</h2>
    <form id="mForm">
      ${Object.entries(MONTHLY_QS).map(([k, q]) => `
        <label class="field">${esc(q)}<textarea name="${k}"></textarea></label>`).join('')}
      <div class="actions"><button class="btn" type="submit">حفظ المراجعة</button></div>
    </form>
  `);
  modal.querySelector('#mForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const answers = {};
    for (const k of Object.keys(MONTHLY_QS)) answers[k] = f[k].value.trim();
    update((s) => {
      s.reviews.push({ id: uid(), type: 'monthly', date: todayISO(), answers });
    });
    closeModal(modal.querySelector('.modal'));
    toast('حُفظت المراجعة الشهرية 📝');
  });
}

export function render(el) {
  const reviews = [...state.reviews].sort((a, b) => b.date.localeCompare(a.date));

  el.innerHTML = `
    <div class="page-head"><h1>المراجعات</h1>
      <div class="dates">سجل تأملاتك الأسبوعية والشهرية</div>
    </div>
    <button class="btn block" id="monthly">📝 مراجعة شهرية الآن</button>
    <p class="muted small center" style="margin:8px 0 16px">المراجعة الأسبوعية تكون ضمن «الجلسة الأسبوعية» في شاشة الأسبوع</p>
    ${reviews.map((r) => {
      const qs = r.type === 'weekly' ? WEEKLY_QS : MONTHLY_QS;
      return `
      <div class="card review-item">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span class="badge soft">${r.type === 'weekly' ? 'أسبوعية' : 'شهرية'}</span>
          <span class="muted small">${gregLong(r.date)} · ${hijriLong(r.date)}</span>
        </div>
        ${Object.entries(qs).map(([k, q]) => r.answers[k] ? `
          <div class="q">${esc(q)}</div>
          <div class="a">${esc(r.answers[k])}</div>` : '').join('')}
        <button class="btn ghost small" data-del="${r.id}" style="margin-top:6px">حذف</button>
      </div>`;
    }).join('') || '<div class="empty">لا مراجعات بعد — أول جلسة أسبوعية ستضيف سجلك الأول</div>'}
  `;

  el.onclick = (ev) => {
    if (ev.target.id === 'monthly') return monthlyWizard();
    const del = ev.target.closest('[data-del]');
    if (del && confirm('حذف هذه المراجعة؟')) {
      update((s) => { s.reviews = s.reviews.filter((r) => r.id !== del.dataset.del); });
    }
  };
}
