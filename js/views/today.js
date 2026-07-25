// شاشة اليوم: أوراد اليوم مرتّبة على فترات اليوم — الفترة الحالية مفتوحة والبقية مطوية

import { state } from '../store.js';
import {
  dayItems, toggleEntry, setEntryQty, logPerWeek, unlogPerWeek,
  logWeekMakeup, waiveEntry, waiveWeekMakeup, addManualEntry, deleteEntry,
  setRoutineTime, routineById,
} from '../engine.js';
import { todayISO, gregLong, hijriLong, gregShort, dayName, n } from '../dates.js';
import { esc, toast, openModal, closeModal } from '../ui.js';
import {
  groupByPart, currentPartId, parts, fmtTime, partRange, ANY_PART,
} from '../dayparts.js';

// حالة العرض تبقى بين عمليات الرسم (rerender يستبدل #view فقط)
let expanded = null;
let lastPart = null;
let makeupsOpen = false;
let quickOpen = false;

function areaOfItem(it) {
  return it.goal ? state.areas.find((a) => a.id === it.goal.areaId) : null;
}

function isDone(it) {
  return !!it.entry?.done;
}

// هل للبند عدّاد كمية يستحق ورقة تفصيل؟
function hasSheet(it) {
  if (it.kind === 'manual') return true;
  if (it.kind === 'fixed') return !!it.goal;
  return false;
}

function itemRow(it) {
  const done = isDone(it);
  const area = areaOfItem(it);
  const dot = area ? `<span class="adot" style="background:${esc(area.color)}"></span>` : '';
  const at = it.entry?.at ?? it.at ?? null;
  const time = at ? `<span class="at">${fmtTime(at)}</span>` : '';

  if (it.kind === 'perweek') {
    const full = it.weekDone >= it.weekTarget && !done;
    return `
    <div class="item ${done ? 'done' : ''}" data-act="perweek" data-rid="${it.routine.id}" data-eid="${it.entry?.id || ''}">
      <span class="check">${done ? '✓' : ''}</span>
      <div class="body">
        <div class="title">${dot}${esc(it.routine.title)}</div>
        <div class="sub">مرن · ${n(it.weekDone)}/${n(it.weekTarget)} هذا الأسبوع${full ? ' — اكتمل ✓' : ''}</div>
      </div>
      ${time}
    </div>`;
  }

  const e = it.entry;
  const sub = it.kind === 'fixed'
    ? esc(it.goal?.title || '')
    : (it.goal ? esc(it.goal.title) : '');
  return `
  <div class="item ${done ? 'done' : ''}" data-act="toggle" data-id="${e.id}">
    <span class="check">${done ? '✓' : ''}</span>
    <div class="body">
      <div class="title">${dot}${esc(e.title)}</div>
      ${sub ? `<div class="sub">${sub}</div>` : ''}
    </div>
    ${time}
    ${hasSheet(it) ? `<button class="more-btn" data-act="sheet" data-id="${e.id}" aria-label="خيارات">⋯</button>` : ''}
  </div>`;
}

function makeupRow(m) {
  if (m.kind === 'makeup-fixed') {
    const e = m.entry;
    return `
    <div class="item makeup" data-act="toggle" data-id="${e.id}">
      <span class="check"></span>
      <div class="body">
        <div class="title">${esc(e.title)}</div>
        <div class="sub">عن ${dayName(e.date)} ${gregShort(e.date)}</div>
      </div>
      <button class="btn ghost small" data-act="waive" data-id="${e.id}">عفو</button>
    </div>`;
  }
  return `
  <div class="item makeup" data-act="weekmakeup" data-rid="${m.routine.id}" data-ws="${m.weekStart}">
    <span class="check"></span>
    <div class="body">
      <div class="title">${esc(m.routine.title)}</div>
      <div class="sub">جلسة عن أسبوع ${gregShort(m.weekStart)}</div>
    </div>
    <button class="btn ghost small" data-act="waiveweek" data-rid="${m.routine.id}" data-ws="${m.weekStart}">عفو</button>
  </div>`;
}

function partSection(group, curId) {
  const { part, items } = group;
  const isAny = part.id === ANY_PART.id;
  const now = part.id === curId;
  // تُعرض الفترات ذات البنود فقط — والفترة الحالية تظهر دائمًا ولو خالية
  if (!items.length && !now) return '';
  const unassigned = isAny && items.some((it) => it.routine);
  const open = expanded.has(part.id);
  const done = items.filter(isDone).length;
  const allDone = items.length && done === items.length;

  return `
    <div class="part ${now ? 'now' : ''} ${open ? 'open' : ''}">
      <button class="part-head" data-act="part" data-pid="${part.id}">
        <span class="ico">${part.icon}</span>
        <span class="pname">${esc(part.name)}</span>
        ${now ? '<span class="nowtag">الآن</span>' : ''}
        <span class="pcount ${allDone ? 'full' : ''}">${n(done)}/${n(items.length)}${allDone ? ' ✓' : ''}</span>
        <span class="chev">${open ? '⌃' : '⌄'}</span>
      </button>
      ${open ? `
        ${!isAny ? `<div class="part-range">${partRange(part)}</div>` : ''}
        ${items.length ? items.map(itemRow).join('') : '<div class="part-empty">لا شيء في هذه الفترة</div>'}
        ${unassigned ? '<button class="btn secondary block small" data-act="assign">🕒 وزّع هذه الأوراد على أوقات اليوم</button>' : ''}
      ` : ''}
    </div>`;
}

// ورقة تفاصيل البند: الكمية والعفو والحذف — بعيدًا عن الصف حتى يبقى الصف بلمسة واحدة
function itemSheet(id) {
  const e = state.entries.find((x) => x.id === id);
  if (!e) return;
  const goal = e.goalId ? state.goals.find((g) => g.id === e.goalId) : null;
  const unit = goal?.unit || 'مرة';
  const modal = openModal(`
    <h2>${esc(e.title)}</h2>
    ${goal ? `<div class="muted" style="margin-bottom:12px">${esc(goal.title)}</div>` : ''}
    <div class="sheet-qty">
      <button class="btn secondary" data-d="-1">−</button>
      <div class="val"><b id="qv">${n(e.qty)}</b> <span class="muted">${esc(unit)}</span></div>
      <button class="btn secondary" data-d="1">+</button>
    </div>
    <div class="actions">
      ${e.routineId ? '<button class="btn secondary" id="sWaive">عفو عن اليوم</button>' : ''}
      ${!e.routineId ? '<button class="btn danger" id="sDel">حذف</button>' : ''}
      <button class="btn" id="sClose">تم</button>
    </div>
  `);
  modal.querySelectorAll('.sheet-qty button').forEach((b) => {
    b.addEventListener('click', () => {
      const cur = state.entries.find((x) => x.id === id);
      setEntryQty(id, cur.qty + Number(b.dataset.d));
      const out = modal.querySelector('#qv');
      if (out) out.textContent = n(state.entries.find((x) => x.id === id).qty);
    });
  });
  modal.querySelector('#sWaive')?.addEventListener('click', () => {
    waiveEntry(id);
    closeModal(modal.querySelector('.modal'));
    toast('عُفي عنه');
  });
  modal.querySelector('#sDel')?.addEventListener('click', () => {
    deleteEntry(id);
    closeModal(modal.querySelector('.modal'));
  });
  modal.querySelector('#sClose').addEventListener('click', () => closeModal(modal.querySelector('.modal')));
}

// توزيع الأوراد غير المُسنَدة على الفترات في شاشة واحدة
function assignSheet() {
  const list = state.routines.filter((r) => !r.partId);
  const opts = (sel) => [{ id: '', name: 'أي وقت', icon: '⏱' }, ...parts()]
    .map((p) => `<option value="${p.id}" ${sel === p.id ? 'selected' : ''}>${p.icon} ${esc(p.name)}</option>`)
    .join('');
  const modal = openModal(`
    <h2>وزّع أورادك على أوقات اليوم</h2>
    <p class="muted" style="margin-bottom:12px">اختر لكل ورد الفترة التي تؤدّيه فيها عادة. يمكنك تحديد ساعة دقيقة لاحقًا من شاشة الأهداف.</p>
    ${list.length ? list.map((r) => `
      <label class="field">${esc(r.title)}
        <select data-rid="${r.id}">${opts('')}</select>
      </label>`).join('') : '<div class="empty">كل أورادك مُسنَدة ✓</div>'}
    <div class="actions">
      <button class="btn" id="aSave">حفظ</button>
      <button class="btn secondary" id="aCancel">إلغاء</button>
    </div>
  `);
  modal.querySelector('#aSave').addEventListener('click', () => {
    modal.querySelectorAll('select[data-rid]').forEach((s) => {
      if (s.value) setRoutineTime(s.dataset.rid, s.value, routineById(s.dataset.rid)?.at || null);
    });
    closeModal(modal.querySelector('.modal'));
    toast('رُتّبت أورادك ✓');
  });
  modal.querySelector('#aCancel').addEventListener('click', () => closeModal(modal.querySelector('.modal')));
}

export function render(el) {
  const t = todayISO();
  const { items, makeups } = dayItems(t);

  const curId = currentPartId();
  if (!expanded || lastPart !== curId) {
    expanded = new Set([curId, ANY_PART.id]);
    lastPart = curId;
  }

  const groups = groupByPart(items);
  const doneCount = items.filter(isDone).length;
  const pct = items.length ? doneCount / items.length : 0;

  el.innerHTML = `
    <div class="today-head">
      <div class="row-top">
        <h1>اليوم</h1>
        <span class="tally">${items.length ? `${n(doneCount)}/${n(items.length)}` : '—'}</span>
      </div>
      <div class="daybar"><i style="width:${Math.round(pct * 100)}%"></i></div>
      <div class="dates">${gregLong(t)} · <span class="hijri">${hijriLong(t)}</span></div>
    </div>

    ${makeups.length ? `
      <div class="makeups ${makeupsOpen ? 'open' : ''}">
        <button class="makeup-head" data-act="makeups">
          <span>⚠️ قضاء متأخر</span>
          <span class="mcount">${n(makeups.length)}</span>
          <span class="chev">${makeupsOpen ? '⌃' : '⌄'}</span>
        </button>
        ${makeupsOpen ? makeups.map(makeupRow).join('') : ''}
      </div>` : ''}

    ${items.length
      ? groups.map((g) => partSection(g, curId)).join('')
      : '<div class="empty">لا أوراد اليوم — أضف أهدافك من شاشة الأهداف 🎯</div>'}

    <div class="quick-add ${quickOpen ? 'open' : ''}">
      ${quickOpen
        ? `<input type="text" id="quickTitle" placeholder="مهمة سريعة لليوم…" autocomplete="off">
           <button class="btn" id="quickAdd">إضافة</button>`
        : '<button class="btn ghost block" data-act="quick">＋ مهمة سريعة</button>'}
    </div>
  `;

  el.onclick = (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'part') {
      const pid = b.dataset.pid;
      if (expanded.has(pid)) expanded.delete(pid); else expanded.add(pid);
      render(el);
    } else if (act === 'makeups') {
      makeupsOpen = !makeupsOpen;
      render(el);
    } else if (act === 'quick') {
      quickOpen = true;
      render(el);
      el.querySelector('#quickTitle')?.focus();
    } else if (act === 'sheet') itemSheet(b.dataset.id);
    else if (act === 'assign') assignSheet();
    else if (act === 'toggle') toggleEntry(b.dataset.id);
    else if (act === 'waive') { waiveEntry(b.dataset.id); toast('عُفي عنه'); }
    else if (act === 'perweek') {
      if (b.dataset.eid) unlogPerWeek(b.dataset.eid);
      else logPerWeek(b.dataset.rid, t);
    } else if (act === 'weekmakeup') { logWeekMakeup(b.dataset.rid, b.dataset.ws); toast('قُضيت الجلسة ✓'); }
    else if (act === 'waiveweek') { waiveWeekMakeup(b.dataset.rid, b.dataset.ws); toast('عُفي عنها'); }
  };

  if (quickOpen) {
    const inp = el.querySelector('#quickTitle');
    const add = () => {
      const v = inp.value.trim();
      if (!v) { quickOpen = false; render(el); return; }
      addManualEntry(t, v);
    };
    el.querySelector('#quickAdd').addEventListener('click', add);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    inp.focus();
  }
}
