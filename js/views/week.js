// شاشة الأسبوع: شبكة الأيام + الجلسة الأسبوعية الموجهة

import { state, update, uid } from '../store.js';
import {
  activePeriod, inPeriod, ensureDay, isPerWeek, perWeekDone,
  pendingFixedMakeups, perWeekShortfalls, waiveEntry, waiveWeekMakeup, waiveAllMakeups,
  addManualEntry, deleteEntry, toggleEntry, weekSummary, goalById, routineById,
} from '../engine.js';
import {
  todayISO, addDays, weekStartOf, weekDates, dayName, gregShort, isToday, n, DAY_NAMES,
} from '../dates.js';
import { esc, openModal, closeModal, toast } from '../ui.js';

let weekOffset = 0;

function dayCard(iso) {
  const p = activePeriod();
  const inP = inPeriod(iso, p);
  if (inP) ensureDay(iso);
  const fixed = state.entries.filter((e) => e.date === iso && e.routineId && !e.makeupFor && !e.waived)
    .filter((e) => { const r = routineById(e.routineId); return r && !isPerWeek(r); });
  const flex = state.entries.filter((e) => e.date === iso && e.routineId && !e.makeupFor && e.done)
    .filter((e) => { const r = routineById(e.routineId); return r && isPerWeek(r); });
  const manual = state.entries.filter((e) => e.date === iso && !e.routineId && !e.waived);
  const items = [...fixed, ...flex, ...manual];
  return `
  <div class="card day-card ${isToday(iso) ? 'today-card' : ''}">
    <div class="day-head">
      <h3>${dayName(iso)} ${isToday(iso) ? '<span class="badge soft">اليوم</span>' : ''}</h3>
      <span class="muted small">${gregShort(iso)}</span>
    </div>
    ${items.map((e) => `
      <div class="mini-item ${e.done ? 'done' : ''}">
        <span class="mark" data-act="toggle" data-id="${e.id}" style="cursor:pointer"></span>
        <span>${esc(e.title)}</span>
        ${!e.routineId ? `<button class="x" data-act="del" data-id="${e.id}">✕</button>` : ''}
      </div>`).join('') || '<div class="muted small">لا شيء مجدول</div>'}
    ${inP ? `<button class="btn ghost small" data-act="add" data-date="${iso}">+ مهمة</button>` : ''}
  </div>`;
}

function addTaskModal(iso) {
  const p = activePeriod();
  const goals = state.goals.filter((g) => g.periodId === p.id);
  const modal = openModal(`
    <h2>مهمة في ${dayName(iso)} ${gregShort(iso)}</h2>
    <form id="tForm">
      <label class="field">المهمة
        <input type="text" name="title" required placeholder="وش الخطوة؟">
      </label>
      <label class="field">مرتبطة بهدف؟ (اختياري)
        <select name="goal">
          <option value="">—</option>
          ${goals.map((g) => `<option value="${g.id}">${esc(g.title)}</option>`).join('')}
        </select>
      </label>
      <div class="actions"><button class="btn" type="submit">إضافة</button></div>
    </form>
  `);
  modal.querySelector('#tForm').addEventListener('submit', (e) => {
    e.preventDefault();
    addManualEntry(iso, e.target.title.value.trim(), e.target.goal.value || null);
    closeModal(modal.querySelector('.modal'));
  });
  modal.querySelector('[name=title]').focus();
}

// ---------- معالج الجلسة الأسبوعية ----------

function sessionWizard() {
  const t = todayISO();
  const thisWeek = weekStartOf(t);
  const lastWeek = addDays(thisWeek, -7);
  const answers = { achieved: '', blocked: '', adjust: '' };
  let step = 0;
  const TOTAL = 5;

  const modal = openModal('<div id="wiz"></div>');
  const wiz = modal.querySelector('#wiz');

  function stepsBar() {
    return `<div class="steps">${Array.from({ length: TOTAL }, (_, i) => `<span class="${i <= step ? 'on' : ''}"></span>`).join('')}</div>`;
  }

  function nav(nextLabel = 'التالي') {
    return `<div class="actions">
      ${step > 0 ? '<button class="btn secondary" data-nav="back">السابق</button>' : ''}
      <button class="btn" data-nav="next">${nextLabel}</button>
    </div>`;
  }

  function stepHTML() {
    if (step === 0) {
      const rows = weekSummary(lastWeek).filter((r) => r.total || r.qty);
      return `<h2>ملخص الأسبوع الماضي</h2>
        <p class="muted small">${gregShort(lastWeek)} ← ${gregShort(addDays(lastWeek, 6))}</p>
        ${rows.length ? rows.map((r) => `
          <div class="card" style="padding:10px 12px">
            <b>${esc(r.goal.title)}</b>
            <div class="muted small">أُنجز ${n(r.done)} من ${n(r.total)} بندًا${r.qty ? ` · ${n(r.qty)} ${esc(r.goal.unit)}` : ''}</div>
          </div>`).join('') : '<div class="empty">لا سجلات للأسبوع الماضي</div>'}
        ${nav()}`;
    }
    if (step === 1) {
      const fixed = pendingFixedMakeups();
      const weekly = state.routines.flatMap((r) => perWeekShortfalls(r).map((sf) => ({ r, ...sf })));
      const none = !fixed.length && !weekly.length;
      return `<h2>الفوائت المتراكمة</h2>
        <p class="muted small">ما يبقى هنا سيلاحقك في شاشة اليوم كبنود قضاء حتى تنجزه — أو اعفُ عنه الآن وابدأ بصفحة نظيفة.</p>
        ${none ? '<div class="empty">لا فوائت — ممتاز 👏</div>' : ''}
        ${fixed.map((e) => `
          <div class="item makeup">
            <div class="body"><div class="title">${esc(e.title)}</div>
            <div class="sub">عن ${dayName(e.date)} ${gregShort(e.date)}</div></div>
            <button class="btn ghost small" data-waive="${e.id}">عفو</button>
          </div>`).join('')}
        ${weekly.map(({ r, weekStart, missing }) => `
          <div class="item makeup">
            <div class="body"><div class="title">${esc(r.title)}</div>
            <div class="sub">${n(missing)} جلسات ناقصة عن أسبوع ${gregShort(weekStart)}</div></div>
            <button class="btn ghost small" data-waiveweek="${r.id}" data-ws="${weekStart}">عفو</button>
          </div>`).join('')}
        ${!none ? '<button class="btn secondary block" data-waiveall>عفو جماعي عن الكل</button>' : ''}
        ${nav()}`;
    }
    if (step === 2) {
      return `<h2>مراجعة الأسبوع</h2>
        <label class="field">وش أنجزت وتفخر فيه؟
          <textarea name="achieved">${esc(answers.achieved)}</textarea>
        </label>
        <label class="field">وش تعثر؟ وليش؟
          <textarea name="blocked">${esc(answers.blocked)}</textarea>
        </label>
        <label class="field">وش بتعدل الأسبوع الجاي؟
          <textarea name="adjust">${esc(answers.adjust)}</textarea>
        </label>
        ${nav()}`;
    }
    if (step === 3) {
      return `<h2>معايرة الأوراد</h2>
        <p class="muted small">عدّل كمية الجلسة إن احتجت — التعديل يسري على الأيام القادمة.</p>
        ${state.routines.map((r) => {
          const g = goalById(r.goalId);
          if (!g) return '';
          return `<div class="routine-row" style="border-top:0;border-bottom:1px dashed var(--line)">
            <div class="grow"><b>${esc(r.title)}</b><div class="muted small">${esc(g.title)}</div></div>
            <input type="number" min="0" step="0.5" value="${r.qtyPerSession}" data-rqty="${r.id}" style="width:70px">
            <span class="muted small">${esc(g.unit)}</span>
          </div>`;
        }).join('')}
        ${nav()}`;
    }
    return `<h2>مهام الأسبوع</h2>
      <p class="muted small">أضف مهام لمرة واحدة ووزعها على الأيام.</p>
      <form id="wTask">
        <div class="row">
          <input type="text" name="title" placeholder="المهمة…" style="flex:2">
          <select name="day">${weekDates(thisWeek).map((d, i) => `<option value="${d}" ${d === t ? 'selected' : ''}>${DAY_NAMES[i]}</option>`).join('')}</select>
        </div>
        <button class="btn secondary block" type="submit" style="margin-top:8px">+ إضافة</button>
      </form>
      <div id="wAdded">${state.entries.filter((e) => !e.routineId && weekDates(thisWeek).includes(e.date) && !e.done).map((e) => `
        <div class="mini-item"><span class="mark"></span>${esc(e.title)} <span class="muted small">· ${dayName(e.date)}</span>
        <button class="x" data-deltask="${e.id}">✕</button></div>`).join('')}</div>
      ${nav('إنهاء الجلسة ✓')}`;
  }

  function draw() {
    wiz.innerHTML = stepsBar() + stepHTML();
    wiz.querySelectorAll('textarea').forEach((ta) => {
      ta.addEventListener('input', () => { answers[ta.name] = ta.value; });
    });
    wiz.querySelectorAll('[data-rqty]').forEach((inp) => {
      inp.addEventListener('change', () => {
        update((s) => {
          const r = s.routines.find((x) => x.id === inp.dataset.rqty);
          if (r) r.qtyPerSession = Math.max(Number(inp.value) || 0, 0);
        });
      });
    });
    wiz.querySelector('#wTask')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = e.target.title.value.trim();
      if (!v) return;
      addManualEntry(e.target.day.value, v);
      draw();
    });
  }

  wiz.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-nav],[data-waive],[data-waiveweek],[data-waiveall],[data-deltask]');
    if (!b) return;
    if (b.dataset.nav === 'back') { step--; draw(); return; }
    if (b.dataset.nav === 'next') {
      if (step === TOTAL - 1) {
        if (answers.achieved || answers.blocked || answers.adjust) {
          update((s) => {
            s.reviews.push({ id: uid(), type: 'weekly', date: t, answers: { ...answers } });
          });
        }
        closeModal(wiz);
        toast('جلسة موفقة — أسبوعك مرتب 🎉');
        return;
      }
      step++; draw(); return;
    }
    if (b.dataset.waive) { waiveEntry(b.dataset.waive); draw(); return; }
    if (b.dataset.waiveweek) { waiveWeekMakeup(b.dataset.waiveweek, b.dataset.ws); draw(); return; }
    if (b.hasAttribute('data-waiveall')) { waiveAllMakeups(); draw(); return; }
    if (b.dataset.deltask) { deleteEntry(b.dataset.deltask); draw(); }
  });

  draw();
}

// ---------- الشاشة ----------

export function render(el) {
  const t = todayISO();
  const ws = addDays(weekStartOf(t), weekOffset * 7);
  const p = activePeriod();

  // الأوراد المرنة لهذا الأسبوع
  const flexRoutines = state.routines.filter((r) => {
    const g = goalById(r.goalId);
    return isPerWeek(r) && g && p && g.periodId === p.id;
  });

  el.innerHTML = `
    <div class="page-head">
      <h1>الأسبوع</h1>
      <div class="dates">${gregShort(ws)} ← ${gregShort(addDays(ws, 6))}</div>
    </div>
    <div class="row" style="margin-bottom:12px">
      <button class="btn secondary" id="prevW">‹ السابق</button>
      ${weekOffset !== 0 ? '<button class="btn secondary" id="curW">الحالي</button>' : '<button class="btn" id="sessionBtn">🪄 الجلسة الأسبوعية</button>'}
      <button class="btn secondary" id="nextW">التالي ›</button>
    </div>
    ${flexRoutines.length ? `
    <div class="card">
      <h3 style="margin-bottom:6px">الأوراد المرنة هذا الأسبوع</h3>
      ${flexRoutines.map((r) => {
        const done = perWeekDone(r, ws);
        const target = r.schedule.perWeek;
        return `<div class="mini-item">
          <span class="mark" style="background:${done >= target ? 'var(--green)' : 'var(--line)'}"></span>
          ${esc(r.title)}
          <span class="muted small" style="margin-inline-start:auto">${n(done)}/${n(target)}</span>
        </div>`;
      }).join('')}
    </div>` : ''}
    ${weekDates(ws).map(dayCard).join('')}
  `;

  el.querySelector('#prevW').addEventListener('click', () => { weekOffset--; render(el); });
  el.querySelector('#nextW').addEventListener('click', () => { weekOffset++; render(el); });
  el.querySelector('#curW')?.addEventListener('click', () => { weekOffset = 0; render(el); });
  el.querySelector('#sessionBtn')?.addEventListener('click', sessionWizard);

  el.onclick = (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'add') addTaskModal(b.dataset.date);
    else if (b.dataset.act === 'del') deleteEntry(b.dataset.id);
    else if (b.dataset.act === 'toggle') toggleEntry(b.dataset.id);
  };
}
