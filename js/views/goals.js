// شاشة الأهداف: الفترة النشطة، المجالات، الأهداف وأورادها، نماذج الإضافة والتعديل

import { state, update, uid } from '../store.js';
import {
  activePeriod, paceInfo, goalDoneQty, routinesOf, commitment,
  scheduleLabel, POLICY_LABELS, isPerWeek, bumpGoal,
} from '../engine.js';
import { gregShort, todayISO, daysBetween, n, DAY_NAMES } from '../dates.js';
import { esc, openModal, closeModal, progressBar, toast } from '../ui.js';
import { areaForm } from './settings.js';
import { parts, partAt, partById, fmtTime } from '../dayparts.js';

function paceLine(goal) {
  const p = paceInfo(goal);
  if (!p) return '<span class="muted small">بلا هدف رقمي — جلسات مستمرة</span>';
  if (p.status === 'ahead') return '<span class="pace ahead">متقدم على المسار 🚀</span>';
  if (p.status === 'on') return '<span class="pace on">على المسار ✓</span>';
  return `<span class="pace behind">تحتاج ${n(Math.ceil(p.neededPerWeek))} ${esc(goal.unit)} أسبوعيًا لتلحق</span>`;
}

// وقت الورد: «🌇 العصر ٣:٠٠» أو «🌇 العصر» أو «⏱ أي وقت»
function timeLabel(r) {
  const p = r.partId ? partById(r.partId) : null;
  if (!p) return '⏱ أي وقت';
  return `${p.icon} ${esc(p.name)}${r.at ? ` ${fmtTime(r.at)}` : ''}`;
}

function goalCard(goal) {
  const p = paceInfo(goal);
  const done = goalDoneQty(goal);
  const routines = routinesOf(goal.id);
  return `
  <div class="card goal-card">
    <div class="goal-head">
      <h3>${esc(goal.title)}</h3>
      <span class="nums">${goal.target ? `${n(done)} / ${n(goal.target)} ${esc(goal.unit)}` : `${n(done)} ${esc(goal.unit)}`}</span>
    </div>
    ${goal.target ? progressBar(p.pct, p.expectedPct) : ''}
    <div style="display:flex;justify-content:space-between;align-items:center">
      ${paceLine(goal)}
      <span>
        <button class="btn ghost small" data-act="bump" data-id="${goal.id}">+١ ${esc(goal.unit)}</button>
        <button class="btn ghost small" data-act="editGoal" data-id="${goal.id}">تعديل</button>
      </span>
    </div>
    ${routines.map((r) => {
      const c = commitment(r);
      return `
      <div class="routine-row">
        <div class="grow">
          <b>${esc(r.title)}</b>
          <div class="muted small">${timeLabel(r)} · ${scheduleLabel(r)}${r.qtyPerSession > 0 ? ` · ${n(r.qtyPerSession)} ${esc(goal.unit)}/جلسة` : ''} · ${POLICY_LABELS[r.makeupPolicy]}</div>
        </div>
        ${c ? `<span class="badge soft">التزام ${n(Math.round(c.pct * 100))}٪</span>` : ''}
        <button class="btn ghost small" data-act="editRoutine" data-id="${r.id}">✎</button>
      </div>`;
    }).join('')}
    <button class="btn ghost small" data-act="addRoutine" data-id="${goal.id}">+ ورد لهذا الهدف</button>
  </div>`;
}

// ---------- نماذج ----------

function scheduleFields(r) {
  const type = !r ? 'daily' : (r.schedule === 'daily' ? 'daily' : (isPerWeek(r) ? 'perweek' : 'days'));
  const days = type === 'days' ? r.schedule.days : [0, 2, 4];
  const perWeek = type === 'perweek' ? r.schedule.perWeek : 3;
  return `
  <label class="field">الجدولة
    <select name="schedType">
      <option value="daily" ${type === 'daily' ? 'selected' : ''}>يوميًا</option>
      <option value="days" ${type === 'days' ? 'selected' : ''}>أيام محددة بالأسبوع</option>
      <option value="perweek" ${type === 'perweek' ? 'selected' : ''}>عدد مرات بالأسبوع (مرن)</option>
    </select>
  </label>
  <div data-sched="days" style="display:${type === 'days' ? 'block' : 'none'}">
    <div class="day-chips">
      ${DAY_NAMES.map((name, i) => `<span class="chip ${days.includes(i) ? 'on' : ''}" data-day="${i}">${name}</span>`).join('')}
    </div>
  </div>
  <div data-sched="perweek" style="display:${type === 'perweek' ? 'block' : 'none'}">
    <label class="field">كم مرة بالأسبوع؟
      <input type="number" name="perWeek" min="1" max="7" value="${perWeek}">
    </label>
  </div>`;
}

function readSchedule(form) {
  const type = form.schedType.value;
  if (type === 'daily') return 'daily';
  if (type === 'perweek') return { perWeek: Math.min(Math.max(Number(form.perWeek.value) || 3, 1), 7) };
  const days = [...form.closest('.modal').querySelectorAll('.chip.on')].map((c) => Number(c.dataset.day));
  return { days: days.length ? days : [0] };
}

function wireScheduleFields(modal) {
  const sel = modal.querySelector('[name=schedType]');
  sel.addEventListener('change', () => {
    modal.querySelectorAll('[data-sched]').forEach((d) => {
      d.style.display = d.dataset.sched === sel.value ? 'block' : 'none';
    });
  });
  modal.querySelectorAll('.chip').forEach((c) => {
    c.addEventListener('click', () => c.classList.toggle('on'));
  });
}

export function routineForm(routine, goalId) {
  const isNew = !routine;
  const modal = openModal(`
    <h2>${isNew ? 'ورد جديد' : 'تعديل الورد'}</h2>
    <form id="rForm">
      <label class="field">اسم الورد
        <input type="text" name="title" required value="${esc(routine?.title || '')}" placeholder="مثال: ورد الحفظ اليومي">
      </label>
      ${scheduleFields(routine)}
      <div class="row">
        <label class="field">وقت اليوم
          <select name="part">
            <option value="" ${!routine?.partId ? 'selected' : ''}>⏱ أي وقت</option>
            ${parts().map((p) => `<option value="${p.id}" ${routine?.partId === p.id ? 'selected' : ''}>${p.icon} ${esc(p.name)}</option>`).join('')}
          </select>
        </label>
        <label class="field">ساعة محددة (اختياري)
          <input type="time" name="at" value="${esc(routine?.at || '')}">
        </label>
      </div>
      <label class="field">الكمية لكل جلسة (٠ = جلسة بلا عدّاد)
        <input type="number" name="qty" min="0" step="0.5" value="${routine?.qtyPerSession ?? 1}">
      </label>
      <label class="field">عند الفوات
        <select name="policy">
          <option value="carry" ${routine?.makeupPolicy === 'carry' ? 'selected' : ''}>قضاء يلاحقني حتى أعوضه</option>
          <option value="pace" ${(routine?.makeupPolicy ?? 'pace') === 'pace' ? 'selected' : ''}>معايرة الوتيرة فقط (بدون قضاء)</option>
          <option value="forgive" ${routine?.makeupPolicy === 'forgive' ? 'selected' : ''}>عفو — يُتجاهل</option>
        </select>
      </label>
      <div class="actions">
        <button class="btn" type="submit">${isNew ? 'إضافة' : 'حفظ'}</button>
        ${!isNew ? '<button class="btn danger" type="button" id="delR">حذف الورد</button>' : ''}
      </div>
    </form>
  `);
  wireScheduleFields(modal);
  modal.querySelector('#rForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const at = f.at.value || null;
    // الساعة المحددة تُرجّح: تُشتقّ منها الفترة تلقائيًا
    const partId = at ? partAt(at).id : (f.part.value || null);
    const data = {
      title: f.title.value.trim(),
      schedule: readSchedule(f),
      partId,
      at,
      qtyPerSession: Math.max(Number(f.qty.value) || 0, 0),
      makeupPolicy: f.policy.value,
    };
    update((s) => {
      if (isNew) {
        s.routines.push({ id: uid(), goalId, createdAt: todayISO(), ...data });
      } else {
        Object.assign(s.routines.find((r) => r.id === routine.id), data);
        // بنود اليوم فما بعده تتبع الوقت الجديد
        const t = todayISO();
        for (const en of s.entries) {
          if (en.routineId === routine.id && !en.makeupFor && en.date >= t) {
            en.partId = partId;
            en.at = at;
          }
        }
      }
    });
    closeModal(modal.querySelector('.modal'));
  });
  modal.querySelector('#delR')?.addEventListener('click', () => {
    if (!confirm('حذف الورد وكل سجلاته؟')) return;
    update((s) => {
      s.routines = s.routines.filter((r) => r.id !== routine.id);
      s.entries = s.entries.filter((e) => e.routineId !== routine.id);
    });
    closeModal(modal.querySelector('.modal'));
  });
}

export function goalForm(goal) {
  const isNew = !goal;
  const p = activePeriod();
  const modal = openModal(`
    <h2>${isNew ? 'هدف جديد' : 'تعديل الهدف'}</h2>
    <form id="gForm">
      <label class="field">عنوان الهدف
        <input type="text" name="title" required value="${esc(goal?.title || '')}" placeholder="مثال: حفظ القرآن">
      </label>
      <label class="field">المجال
        <select name="area">
          ${state.areas.map((a) => `<option value="${a.id}" ${goal?.areaId === a.id ? 'selected' : ''}>${esc(a.icon || '')} ${esc(a.name)}</option>`).join('')}
        </select>
      </label>
      <div class="row">
        <label class="field">وحدة القياس
          <input type="text" name="unit" required value="${esc(goal?.unit || '')}" placeholder="وجه، صفحة، كتاب…">
        </label>
        <label class="field">الرقم المستهدف للفترة
          <input type="number" name="target" min="0" step="0.5" value="${goal?.target ?? ''}" placeholder="اتركه فارغًا بلا هدف">
        </label>
      </div>
      <div class="actions">
        <button class="btn" type="submit">${isNew ? 'إضافة' : 'حفظ'}</button>
        ${!isNew ? '<button class="btn danger" type="button" id="delG">حذف الهدف</button>' : ''}
      </div>
    </form>
  `);
  modal.querySelector('#gForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const data = {
      title: f.title.value.trim(),
      areaId: f.area.value,
      unit: f.unit.value.trim() || 'مرة',
      target: f.target.value === '' ? null : Math.max(Number(f.target.value) || 0, 0) || null,
    };
    update((s) => {
      if (isNew) s.goals.push({ id: uid(), periodId: p.id, ...data });
      else Object.assign(s.goals.find((g) => g.id === goal.id), data);
    });
    const created = isNew ? state.goals[state.goals.length - 1] : null;
    closeModal(modal.querySelector('.modal'));
    if (created) routineForm(null, created.id); // مباشرة: أضف أول ورد للهدف الجديد
  });
  modal.querySelector('#delG')?.addEventListener('click', () => {
    if (!confirm('حذف الهدف وأوراده وسجلاته؟')) return;
    update((s) => {
      s.goals = s.goals.filter((g) => g.id !== goal.id);
      const rids = s.routines.filter((r) => r.goalId === goal.id).map((r) => r.id);
      s.routines = s.routines.filter((r) => r.goalId !== goal.id);
      s.entries = s.entries.filter((e) => e.goalId !== goal.id && !rids.includes(e.routineId));
    });
    closeModal(modal.querySelector('.modal'));
  });
}

// ---------- الشاشة ----------

export function render(el) {
  const p = activePeriod();
  if (!p) {
    el.innerHTML = '<div class="empty">لا توجد فترة — أنشئ فترة من الإعدادات</div>';
    return;
  }
  const t = todayISO();
  const total = daysBetween(p.startDate, p.endDate) + 1;
  const elapsed = Math.min(Math.max(daysBetween(p.startDate, t) + 1, 0), total);
  const goals = state.goals.filter((g) => g.periodId === p.id);

  let sections = '';
  for (const area of state.areas) {
    const list = goals.filter((g) => g.areaId === area.id);
    if (!list.length) continue;
    sections += `
      <div class="section-title">
        <span class="dot" style="background:${area.color}"></span>${esc(area.icon || '')} ${esc(area.name)}
        <button class="btn ghost small" data-act="editArea" data-id="${area.id}" style="margin-inline-start:auto">✎</button>
      </div>
      ${list.map(goalCard).join('')}`;
  }

  el.innerHTML = `
    <div class="page-head">
      <h1>الأهداف</h1>
      <div class="dates">${esc(p.name)} · ${gregShort(p.startDate)} ← ${gregShort(p.endDate)}</div>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;font-size:.82rem">
        <b>عمر الفترة</b>
        <span class="muted">مضى ${n(elapsed)} من ${n(total)} يومًا (${n(Math.round((elapsed / total) * 100))}٪)</span>
      </div>
      ${progressBar(elapsed / total)}
    </div>
    ${sections || '<div class="empty">لا أهداف بعد — ابدأ بهدفك الأول 🎯</div>'}
    <button class="btn block" id="addGoal">+ هدف جديد</button>
    <button class="btn secondary block" id="addArea" style="margin-top:8px">+ مجال جديد</button>
  `;

  el.onclick = (ev) => {
    const b = ev.target.closest('[data-act], #addGoal, #addArea');
    if (!b) return;
    if (b.id === 'addGoal') return goalForm(null);
    if (b.id === 'addArea') return areaForm(null);
    const act = b.dataset.act;
    if (act === 'editArea') areaForm(state.areas.find((a) => a.id === b.dataset.id));
    else if (act === 'editGoal') goalForm(state.goals.find((g) => g.id === b.dataset.id));
    else if (act === 'addRoutine') routineForm(null, b.dataset.id);
    else if (act === 'editRoutine') {
      const r = state.routines.find((x) => x.id === b.dataset.id);
      routineForm(r, r.goalId);
    } else if (act === 'bump') {
      bumpGoal(b.dataset.id, 1);
      toast('أُضيف إنجاز +١ 🎉');
    }
  };
}
