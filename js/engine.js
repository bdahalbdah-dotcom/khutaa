// المحرك: توليد يوميات الأوراد، سياسات التعويض (قضاء/وتيرة/عفو)، التقدم والمسار ونسبة الالتزام

import { state, silently, update, uid } from './store.js';
import {
  todayISO, addDays, dayOfWeek, weekStartOf, weekDates, daysBetween, n,
} from './dates.js';
import { nowHM, currentPartId } from './dayparts.js';

// ---------- استعلامات أساسية ----------

export function activePeriod() {
  return state.periods.find((p) => p.id === state.settings.activePeriodId) || state.periods[0] || null;
}

export function inPeriod(iso, p) {
  return !!p && iso >= p.startDate && iso <= p.endDate;
}

export function areaOf(goal) {
  return state.areas.find((a) => a.id === goal.areaId) || null;
}

export function goalById(id) {
  return state.goals.find((g) => g.id === id) || null;
}

export function routineById(id) {
  return state.routines.find((r) => r.id === id) || null;
}

export function routinesOf(goalId) {
  return state.routines.filter((r) => r.goalId === goalId);
}

export function periodGoals(p) {
  return p ? state.goals.filter((g) => g.periodId === p.id) : [];
}

export function isPerWeek(r) {
  return typeof r.schedule === 'object' && r.schedule !== null && 'perWeek' in r.schedule;
}

// هل الورد الثابت (يومي/أيام محددة) مجدول في هذا اليوم؟
export function isFixedScheduled(r, iso) {
  if (r.schedule === 'daily') return true;
  if (typeof r.schedule === 'object' && Array.isArray(r.schedule.days)) {
    return r.schedule.days.includes(dayOfWeek(iso));
  }
  return false;
}

export function scheduleLabel(r) {
  if (r.schedule === 'daily') return 'يوميًا';
  if (isPerWeek(r)) return `${n(r.schedule.perWeek)} مرات بالأسبوع (مرن)`;
  const names = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  return r.schedule.days.map((d) => names[d]).join('، ');
}

export const POLICY_LABELS = { carry: 'قضاء يلاحق', pace: 'معايرة وتيرة', forgive: 'عفو' };

// ---------- توليد بنود الأيام (materialization) ----------

function fixedRoutineStart(r, p) {
  const created = r.createdAt || p.startDate;
  return created > p.startDate ? created : p.startDate;
}

// ينشئ بنود الأوراد الثابتة ليوم معيّن إن لم تكن موجودة (بدون إشعار الواجهة)
export function ensureDay(iso) {
  const p = activePeriod();
  if (!inPeriod(iso, p)) return;
  const additions = [];
  for (const r of state.routines) {
    const g = goalById(r.goalId);
    if (!g || g.periodId !== p.id) continue;
    if (isPerWeek(r)) continue; // الأوراد المرنة لا تُثبَّت في أيام
    if (iso < fixedRoutineStart(r, p)) continue;
    if (!isFixedScheduled(r, iso)) continue;
    const exists = state.entries.some((e) => e.routineId === r.id && e.date === iso && !e.makeupFor);
    if (!exists) {
      additions.push({
        id: uid(), date: iso, routineId: r.id, goalId: g.id,
        title: r.title, qty: r.qtyPerSession, done: false, waived: false,
        makeupFor: null, doneAt: null, doneTime: null, note: '',
        partId: r.partId ?? null, at: r.at ?? null,
      });
    }
  }
  if (additions.length) silently((s) => { s.entries.push(...additions); });
}

// عند فتح التطبيق: توليد بنود كل الأيام منذ آخر فتح (بحد أقصى 60 يومًا للخلف)
export function backfill() {
  const t = todayISO();
  const p = activePeriod();
  if (!p) return;
  let from = state.settings.lastOpenedDate || t;
  if (from < p.startDate) from = p.startDate;
  if (daysBetween(from, t) > 60) from = addDays(t, -60);
  for (let d = from; d <= t; d = addDays(d, 1)) ensureDay(d);
  if (state.settings.lastOpenedDate !== t) {
    silently((s) => { s.settings.lastOpenedDate = t; });
  }
}

// ---------- التعويض (قضاء الأوراد الثابتة) ----------

// بنود ثابتة فائتة بسياسة «قضاء» لم تُنجز ولم يُعفَ عنها
export function pendingFixedMakeups() {
  const t = todayISO();
  const p = activePeriod();
  return state.entries
    .filter((e) => {
      if (!e.routineId || e.makeupFor || e.done || e.waived) return false;
      if (e.date >= t || !inPeriod(e.date, p)) return false;
      const r = routineById(e.routineId);
      return r && !isPerWeek(r) && r.makeupPolicy === 'carry';
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// عدد جلسات ورد مرن المنجزة في أسبوع (بدون بنود القضاء)
export function perWeekDone(r, weekStartIso) {
  const days = weekDates(weekStartIso);
  return state.entries.filter(
    (e) => e.routineId === r.id && !e.makeupFor && e.done && days.includes(e.date),
  ).length;
}

// نقص الأسابيع الماضية لورد مرن بسياسة «قضاء» (حتى 4 أسابيع للخلف)، مخصومًا منه ما قُضي أو عُفي
export function perWeekShortfalls(r) {
  if (!isPerWeek(r) || r.makeupPolicy !== 'carry') return [];
  const p = activePeriod();
  const t = todayISO();
  const currentWeek = weekStartOf(t);
  const start = weekStartOf(fixedRoutineStart(r, p));
  const out = [];
  for (let w = start; w < currentWeek; w = addDays(w, 7)) {
    if (daysBetween(w, currentWeek) > 28) continue;
    const done = perWeekDone(r, w);
    const credited = state.entries.filter(
      (e) => e.routineId === r.id && e.makeupFor === w && (e.done || e.waived),
    ).length;
    const missing = r.schedule.perWeek - done - credited;
    if (missing > 0) out.push({ weekStart: w, missing });
  }
  return out;
}

export function waiveEntry(id) {
  update((s) => {
    const e = s.entries.find((x) => x.id === id);
    if (e) { e.waived = true; e.done = false; }
  });
}

// عفو عن جلسة مرنة واحدة من أسبوع فائت (بند عفو محسوب)
export function waiveWeekMakeup(routineId, weekStart) {
  const r = routineById(routineId);
  update((s) => {
    s.entries.push({
      id: uid(), date: todayISO(), routineId, goalId: r.goalId,
      title: r.title, qty: 0, done: false, waived: true,
      makeupFor: weekStart, doneAt: null, doneTime: null, note: '',
      partId: null, at: null,
    });
  });
}

export function waiveAllMakeups() {
  const fixed = pendingFixedMakeups().map((e) => e.id);
  update((s) => {
    for (const id of fixed) {
      const e = s.entries.find((x) => x.id === id);
      if (e) e.waived = true;
    }
    // عفو عن نقص الأوراد المرنة: بنود عفو محسوبة
    for (const r of s.routines) {
      if (!isPerWeek(r) || r.makeupPolicy !== 'carry') continue;
      for (const sf of perWeekShortfalls(r)) {
        for (let i = 0; i < sf.missing; i++) {
          s.entries.push({
            id: uid(), date: todayISO(), routineId: r.id, goalId: r.goalId,
            title: r.title, qty: 0, done: false, waived: true,
            makeupFor: sf.weekStart, doneAt: null, doneTime: null, note: '',
            partId: null, at: null,
          });
        }
      }
    }
  });
}

// ---------- بنود اليوم للعرض ----------

// قائمة يوم كاملة مقسمة: أوراد ثابتة + أوراد مرنة + قضاء (لليوم الحالي فقط) + مهام يدوية
export function dayItems(iso) {
  const t = todayISO();
  const p = activePeriod();
  ensureDay(iso);
  const items = [];

  // الأوراد الثابتة المجدولة اليوم
  for (const e of state.entries) {
    if (e.date === iso && e.routineId && !e.makeupFor) {
      const r = routineById(e.routineId);
      if (r && !isPerWeek(r)) items.push({ kind: 'fixed', entry: e, routine: r, goal: goalById(e.goalId) });
    }
  }

  // الأوراد المرنة (perWeek): تظهر كل يوم حتى يكتمل عدد الأسبوع
  if (inPeriod(iso, p)) {
    const ws = weekStartOf(iso);
    for (const r of state.routines) {
      if (!isPerWeek(r)) continue;
      const g = goalById(r.goalId);
      if (!g || g.periodId !== p.id) continue;
      if (iso < fixedRoutineStart(r, p)) continue;
      const doneCount = perWeekDone(r, ws);
      const todayEntry = state.entries.find(
        (e) => e.routineId === r.id && e.date === iso && !e.makeupFor,
      );
      items.push({
        kind: 'perweek', routine: r, goal: g, entry: todayEntry || null,
        weekDone: doneCount, weekTarget: r.schedule.perWeek,
        partId: r.partId ?? null, at: r.at ?? null,
      });
    }
  }

  // القضاء يظهر في قائمة اليوم الحالي فقط
  const makeups = [];
  if (iso === t) {
    for (const e of pendingFixedMakeups()) {
      makeups.push({ kind: 'makeup-fixed', entry: e, routine: routineById(e.routineId), goal: goalById(e.goalId) });
    }
    for (const r of state.routines) {
      for (const sf of perWeekShortfalls(r)) {
        for (let i = 0; i < sf.missing; i++) {
          makeups.push({ kind: 'makeup-week', routine: r, goal: goalById(r.goalId), weekStart: sf.weekStart });
        }
      }
    }
  }

  // المهام اليدوية
  for (const e of state.entries) {
    if (e.date === iso && !e.routineId && !e.waived) {
      items.push({ kind: 'manual', entry: e, goal: e.goalId ? goalById(e.goalId) : null });
    }
  }

  return { items, makeups };
}

// ---------- أفعال الإنجاز ----------

export function toggleEntry(id) {
  update((s) => {
    const e = s.entries.find((x) => x.id === id);
    if (!e) return;
    e.done = !e.done;
    e.doneAt = e.done ? todayISO() : null;
    e.doneTime = e.done ? nowHM() : null;
    if (e.done) e.waived = false;
  });
}

export function setEntryQty(id, qty) {
  update((s) => {
    const e = s.entries.find((x) => x.id === id);
    if (e) e.qty = Math.max(0, qty);
  });
}

// تسجيل جلسة ورد مرن في يوم
export function logPerWeek(routineId, iso) {
  const r = routineById(routineId);
  update((s) => {
    s.entries.push({
      id: uid(), date: iso, routineId, goalId: r.goalId, title: r.title,
      qty: r.qtyPerSession, done: true, waived: false, makeupFor: null,
      doneAt: todayISO(), doneTime: nowHM(), note: '',
      partId: r.partId ?? null, at: r.at ?? null,
    });
  });
}

export function unlogPerWeek(entryId) {
  update((s) => {
    s.entries = s.entries.filter((e) => e.id !== entryId);
  });
}

// قضاء جلسة مرنة عن أسبوع فائت
export function logWeekMakeup(routineId, weekStart) {
  const r = routineById(routineId);
  update((s) => {
    s.entries.push({
      id: uid(), date: todayISO(), routineId, goalId: r.goalId,
      title: r.title, qty: r.qtyPerSession, done: true, waived: false,
      makeupFor: weekStart, doneAt: todayISO(), doneTime: nowHM(), note: '',
      partId: null, at: null,
    });
  });
}

export function addManualEntry(iso, title, goalId = null, qty = 0, partId = currentPartId()) {
  update((s) => {
    s.entries.push({
      id: uid(), date: iso, routineId: null, goalId, title, qty,
      done: false, waived: false, makeupFor: null, doneAt: null, doneTime: null,
      note: '', partId, at: null,
    });
  });
}

// إسناد الورد لفترة/ساعة — والبنود المولَّدة من اليوم فصاعدًا تتبع الوقت الجديد
export function setRoutineTime(routineId, partId, at = null) {
  const t = todayISO();
  update((s) => {
    const r = s.routines.find((x) => x.id === routineId);
    if (!r) return;
    r.partId = partId || null;
    r.at = at || null;
    for (const e of s.entries) {
      if (e.routineId === routineId && !e.makeupFor && e.date >= t) {
        e.partId = r.partId;
        e.at = r.at;
      }
    }
  });
}

export function deleteEntry(id) {
  update((s) => { s.entries = s.entries.filter((e) => e.id !== id); });
}

// زيادة يدوية لعداد هدف (مثل: أنهيت كتابًا)
export function bumpGoal(goalId, qty) {
  const g = goalById(goalId);
  update((s) => {
    s.entries.push({
      id: uid(), date: todayISO(), routineId: null, goalId,
      title: `+${qty} ${g.unit}`, qty, done: true, waived: false,
      makeupFor: null, doneAt: todayISO(), doneTime: nowHM(), note: '',
      partId: currentPartId(), at: null,
    });
  });
}

// ---------- التقدم والمسار ----------

export function goalDoneQty(goal) {
  const p = state.periods.find((x) => x.id === goal.periodId);
  return state.entries
    .filter((e) => e.goalId === goal.id && e.done && (!p || (e.date >= p.startDate && e.date <= p.endDate)))
    .reduce((sum, e) => sum + (e.qty || 0), 0);
}

// حالة المسار: ahead / on / behind + المطلوب أسبوعيًا
export function paceInfo(goal) {
  if (!goal.target) return null;
  const p = state.periods.find((x) => x.id === goal.periodId);
  if (!p) return null;
  const t = todayISO();
  const total = daysBetween(p.startDate, p.endDate) + 1;
  const elapsed = Math.min(Math.max(daysBetween(p.startDate, t) + 1, 0), total);
  const expected = (goal.target * elapsed) / total;
  const actual = goalDoneQty(goal);
  const remainingWeeks = Math.max((total - elapsed) / 7, 0.001);
  const neededPerWeek = Math.max((goal.target - actual) / remainingWeeks, 0);
  const weeklyRate = (goal.target / total) * 7;
  let status = 'on';
  if (actual >= expected + weeklyRate) status = 'ahead';
  else if (actual < expected - weeklyRate) status = 'behind';
  return { expected, actual, status, neededPerWeek, pct: Math.min(actual / goal.target, 1), expectedPct: Math.min(expected / goal.target, 1) };
}

// نسبة الالتزام بالورد
export function commitment(r) {
  const p = activePeriod();
  const t = todayISO();
  if (!p) return null;
  const start = fixedRoutineStart(r, p);
  if (isPerWeek(r)) {
    const firstWeek = weekStartOf(start);
    const currentWeek = weekStartOf(t);
    let met = 0; let weeks = 0;
    for (let w = firstWeek; w < currentWeek; w = addDays(w, 7)) {
      weeks++;
      const credited = state.entries.filter((e) => e.routineId === r.id && e.makeupFor === w && e.done).length;
      if (perWeekDone(r, w) + credited >= r.schedule.perWeek) met++;
    }
    if (weeks === 0) return null;
    return { done: met, total: weeks, pct: met / weeks, kind: 'weeks' };
  }
  const scheduled = state.entries.filter(
    (e) => e.routineId === r.id && !e.makeupFor && e.date >= start && e.date <= t,
  );
  if (!scheduled.length) return null;
  const done = scheduled.filter((e) => e.done).length;
  return { done, total: scheduled.length, pct: done / scheduled.length, kind: 'days' };
}

// ---------- ملخصات للأسبوع والإحصائيات ----------

export function weekSummary(weekStartIso) {
  const days = weekDates(weekStartIso);
  const p = activePeriod();
  const byGoal = new Map();
  for (const g of periodGoals(p)) {
    byGoal.set(g.id, { goal: g, qty: 0, done: 0, total: 0 });
  }
  for (const e of state.entries) {
    if (!days.includes(e.date) || e.waived) continue;
    const row = e.goalId ? byGoal.get(e.goalId) : null;
    if (!row) continue;
    row.total++;
    if (e.done) { row.done++; row.qty += e.qty || 0; }
  }
  return [...byGoal.values()];
}

// إنجازات كل أسبوع عبر الفترة (عدد البنود المنجزة حسب تاريخ الإنجاز)
export function weeklyTrend() {
  const p = activePeriod();
  if (!p) return [];
  const t = todayISO();
  const end = t < p.endDate ? t : p.endDate;
  const out = [];
  for (let w = weekStartOf(p.startDate); w <= weekStartOf(end); w = addDays(w, 7)) {
    const days = weekDates(w);
    const count = state.entries.filter((e) => e.done && days.includes(e.doneAt || e.date)).length;
    out.push({ weekStart: w, count });
  }
  return out;
}

// توازن المجالات: عدد الإنجازات لكل مجال خلال الفترة
export function areaBalance() {
  const p = activePeriod();
  const map = new Map(state.areas.map((a) => [a.id, { area: a, count: 0 }]));
  for (const e of state.entries) {
    if (!e.done || !e.goalId) continue;
    const g = goalById(e.goalId);
    if (!g || !p || g.periodId !== p.id) continue;
    const row = map.get(g.areaId);
    if (row) row.count++;
  }
  return [...map.values()];
}
