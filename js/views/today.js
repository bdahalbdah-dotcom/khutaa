// شاشة اليوم: أوراد اليوم + القضاء + المهام اليدوية

import { state } from '../store.js';
import {
  dayItems, toggleEntry, setEntryQty, logPerWeek, unlogPerWeek,
  logWeekMakeup, waiveEntry, waiveWeekMakeup, addManualEntry, deleteEntry,
} from '../engine.js';
import { todayISO, gregLong, hijriLong, gregShort, dayName, n } from '../dates.js';
import { esc, ring, toast } from '../ui.js';

function unitLabel(goal, qty) {
  return goal && qty > 0 ? `${n(qty)} ${goal.unit}` : '';
}

function itemRow(it) {
  if (it.kind === 'fixed' || it.kind === 'manual') {
    const e = it.entry;
    const sub = it.kind === 'fixed'
      ? esc(it.goal?.title || '')
      : (it.goal ? esc(it.goal.title) : 'مهمة يوم');
    return `
    <div class="item ${e.done ? 'done' : ''}" data-id="${e.id}">
      <button class="check" data-act="toggle" data-id="${e.id}">${e.done ? '✓' : ''}</button>
      <div class="body">
        <div class="title">${esc(e.title)}</div>
        <div class="sub">${sub}</div>
      </div>
      ${it.goal && (e.qty > 0 || it.kind === 'fixed') ? `
      <div class="qty">
        <button data-act="qty" data-id="${e.id}" data-d="-1">−</button>
        <span class="val">${unitLabel(it.goal, e.qty) || '—'}</span>
        <button data-act="qty" data-id="${e.id}" data-d="1">+</button>
      </div>` : ''}
      ${it.kind === 'manual' ? `<button class="btn ghost small" data-act="del" data-id="${e.id}">✕</button>` : ''}
    </div>`;
  }
  if (it.kind === 'perweek') {
    const done = !!it.entry?.done;
    return `
    <div class="item ${done ? 'done' : ''}">
      <button class="check" data-act="perweek" data-rid="${it.routine.id}" data-eid="${it.entry?.id || ''}">${done ? '✓' : ''}</button>
      <div class="body">
        <div class="title">${esc(it.routine.title)}</div>
        <div class="sub">${esc(it.goal.title)} · مرن: ${n(it.weekDone)}/${n(it.weekTarget)} هذا الأسبوع</div>
      </div>
      ${it.weekDone >= it.weekTarget && !done ? '<span class="badge soft">اكتمل الأسبوع ✓</span>' : ''}
    </div>`;
  }
  return '';
}

function makeupRow(m) {
  if (m.kind === 'makeup-fixed') {
    const e = m.entry;
    return `
    <div class="item makeup" data-id="${e.id}">
      <button class="check" data-act="toggle" data-id="${e.id}"></button>
      <div class="body">
        <div class="title">${esc(e.title)}</div>
        <div class="sub"><span class="badge makeup">قضاء</span> عن ${dayName(e.date)} ${gregShort(e.date)}</div>
      </div>
      ${m.goal && e.qty > 0 ? `
      <div class="qty">
        <button data-act="qty" data-id="${e.id}" data-d="-1">−</button>
        <span class="val">${unitLabel(m.goal, e.qty)}</span>
        <button data-act="qty" data-id="${e.id}" data-d="1">+</button>
      </div>` : ''}
      <button class="btn ghost small" data-act="waive" data-id="${e.id}" title="عفو">عفو</button>
    </div>`;
  }
  // makeup-week
  return `
  <div class="item makeup">
    <button class="check" data-act="weekmakeup" data-rid="${m.routine.id}" data-ws="${m.weekStart}"></button>
    <div class="body">
      <div class="title">${esc(m.routine.title)}</div>
      <div class="sub"><span class="badge makeup">قضاء</span> جلسة عن أسبوع ${gregShort(m.weekStart)}</div>
    </div>
    <button class="btn ghost small" data-act="waiveweek" data-rid="${m.routine.id}" data-ws="${m.weekStart}">عفو</button>
  </div>`;
}

export function render(el) {
  const t = todayISO();
  const { items, makeups } = dayItems(t);

  // تجميع حسب المجال
  const byArea = new Map();
  for (const it of items) {
    const areaId = it.goal?.areaId || '_none';
    if (!byArea.has(areaId)) byArea.set(areaId, []);
    byArea.get(areaId).push(it);
  }

  const doneCount = items.filter((it) => (it.kind === 'perweek' ? !!it.entry?.done : it.entry.done)).length;
  const total = items.length + makeups.length;
  const allDone = doneCount + 0;
  const pct = total ? allDone / total : 0;

  let sections = '';
  for (const [areaId, list] of byArea) {
    const area = state.areas.find((a) => a.id === areaId);
    sections += `
      <div class="section-title">
        ${area ? `<span class="dot" style="background:${area.color}"></span>${esc(area.icon || '')} ${esc(area.name)}` : 'مهام اليوم'}
      </div>
      ${list.map(itemRow).join('')}`;
  }

  el.innerHTML = `
    <div class="page-head">
      <h1>اليوم</h1>
      <div class="dates">${gregLong(t)} · <span class="hijri">${hijriLong(t)}</span></div>
    </div>

    <div class="card ring-wrap">
      ${ring(pct, 74, total ? `${n(doneCount)}/${n(total)}` : '—')}
      <div class="info">
        <h3>${pct >= 1 && total ? 'أنجزت يومك كاملًا 🎉' : pct > 0 ? 'استمر، خطوة خطوة' : 'يومك أمامك — ابدأ بخطوة'}</h3>
        <div class="muted">${n(total)} خطوة اليوم${makeups.length ? ` · منها ${n(makeups.length)} قضاء` : ''}</div>
      </div>
    </div>

    ${makeups.length ? `
      <div class="section-title"><span class="dot" style="background:var(--amber)"></span>استدراك وقضاء</div>
      ${makeups.map(makeupRow).join('')}` : ''}

    ${sections || '<div class="empty">لا أوراد اليوم — أضف أهدافك من شاشة الأهداف 🎯</div>'}

    <div class="quick-add">
      <input type="text" id="quickTitle" placeholder="مهمة سريعة لليوم…">
      <button class="btn" id="quickAdd">إضافة</button>
    </div>
  `;

  el.onclick = (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'toggle') toggleEntry(b.dataset.id);
    else if (act === 'qty') {
      const e = state.entries.find((x) => x.id === b.dataset.id);
      if (e) setEntryQty(e.id, e.qty + Number(b.dataset.d));
    } else if (act === 'del') deleteEntry(b.dataset.id);
    else if (act === 'waive') { waiveEntry(b.dataset.id); toast('عُفي عنه'); }
    else if (act === 'perweek') {
      if (b.dataset.eid) unlogPerWeek(b.dataset.eid);
      else logPerWeek(b.dataset.rid, t);
    } else if (act === 'weekmakeup') { logWeekMakeup(b.dataset.rid, b.dataset.ws); toast('قُضيت الجلسة ✓'); }
    else if (act === 'waiveweek') { waiveWeekMakeup(b.dataset.rid, b.dataset.ws); toast('عُفي عنها'); }
  };

  const add = () => {
    const inp = el.querySelector('#quickTitle');
    const v = inp.value.trim();
    if (!v) return;
    addManualEntry(t, v);
  };
  el.querySelector('#quickAdd').addEventListener('click', add);
  el.querySelector('#quickTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
}
