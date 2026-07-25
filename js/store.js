// الحالة المركزية: localStorage + بذرة أولية + تصدير/استيراد

import { todayISO } from './dates.js';
import { DEFAULT_PARTS } from './dayparts.js';

const KEY = 'khutaa-state-v1';

export let state = null;
const listeners = new Set();

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

// تعديل مع إشعار الواجهة
export function update(fn) {
  fn(state);
  persist();
  listeners.forEach((l) => l());
}

// تعديل صامت (أثناء التهيئة قبل الرسم)
export function silently(fn) {
  fn(state);
  persist();
}

export function onChange(fn) {
  listeners.add(fn);
}

export function load() {
  try {
    state = JSON.parse(localStorage.getItem(KEY));
  } catch {
    state = null;
  }
  if (!state || !state.version) {
    state = seed();
    persist();
  }
  migrate();
  return state;
}

// ترحيلات: إضافات لاحقة تصل للتطبيقات المثبتة بدون مساس ببيانات المستخدم
function migrate() {
  state.migrations ??= {};
  if (!state.migrations.fitness1) {
    const p = state.periods.find((x) => x.id === state.settings.activePeriodId) || state.periods[0];
    if (p) {
      let area = state.areas.find((a) => a.name.includes('صحة') || a.name.includes('لياقة'));
      if (!area) {
        area = { id: uid(), name: 'صحة ولياقة', color: '#f97316', icon: '💪' };
        state.areas.push(area);
      }
      if (!state.goals.some((g) => g.title === 'النادي')) {
        const goal = { id: uid(), periodId: p.id, areaId: area.id, title: 'النادي', unit: 'جلسة', target: 100 };
        state.goals.push(goal);
        state.routines.push(
          { id: uid(), goalId: goal.id, title: 'جلسة الحديد', schedule: { perWeek: 3 }, qtyPerSession: 1, makeupPolicy: 'pace', createdAt: todayISO() },
          { id: uid(), goalId: goal.id, title: 'تمرين كرة القدم', schedule: { perWeek: 1 }, qtyPerSession: 1, makeupPolicy: 'pace', createdAt: todayISO() },
        );
      }
    }
    state.migrations.fitness1 = true;
    persist();
  }

  // فترات اليوم: الأوراد القديمة تهبط في «أي وقت» ويوزّعها المستخدم من شاشة اليوم
  if (!state.migrations.dayparts1) {
    state.settings.dayParts ??= DEFAULT_PARTS.map((p) => ({ ...p }));
    for (const r of state.routines) { r.partId ??= null; r.at ??= null; }
    for (const e of state.entries) { e.partId ??= null; e.at ??= null; e.doneTime ??= null; }
    state.migrations.dayparts1 = true;
    persist();
  }
}

// بذرة أولية نظيفة: فترة ومجالات افتراضية فقط — المستخدم الجديد يبني أهدافه من شاشة الترحيب
function seed() {
  const t = todayISO();
  const year = Number(t.slice(0, 4));
  const firstHalf = t.slice(5) < '07-01';
  const period = {
    id: uid(),
    name: firstHalf ? `النصف الأول ${year}` : `النصف الثاني ${year}`,
    type: 'half',
    startDate: firstHalf ? `${year}-01-01` : `${year}-07-01`,
    endDate: firstHalf ? `${year}-06-30` : `${year}-12-31`,
  };
  return {
    version: 1,
    migrations: { fitness1: true, dayparts1: true },
    periods: [period],
    areas: [
      { id: uid(), name: 'دين وعبادة', color: '#0e9f6e', icon: '🕌' },
      { id: uid(), name: 'قراءة وتعلم', color: '#3b82f6', icon: '📚' },
      { id: uid(), name: 'صحة ولياقة', color: '#f97316', icon: '💪' },
    ],
    goals: [],
    routines: [],
    entries: [],
    reviews: [],
    settings: {
      theme: 'auto',
      dayParts: DEFAULT_PARTS.map((p) => ({ ...p })),
      activePeriodId: period.id,
      lastBackupDate: null,
      lastOpenedDate: t,
      installDate: t,
      onboarded: false,
    },
  };
}

export function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `khutaa-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  update((s) => { s.settings.lastBackupDate = todayISO(); });
}

export function importJSON(file, onDone) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.version || !Array.isArray(data.goals) || !Array.isArray(data.entries)) {
        throw new Error('صيغة غير صحيحة');
      }
      state = data;
      migrate(); // نسخة قديمة قد تفتقد فترات اليوم
      persist();
      onDone(null);
    } catch (e) {
      onDone(e);
    }
  };
  reader.onerror = () => onDone(new Error('تعذرت قراءة الملف'));
  reader.readAsText(file);
}
