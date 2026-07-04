// الحالة المركزية: localStorage + بذرة أولية + تصدير/استيراد

import { todayISO } from './dates.js';

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
}

// بذرة أولية من أهداف المستخدم الفعلية — كلها قابلة للتعديل من داخل التطبيق
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
  const aDin = { id: uid(), name: 'دين وعبادة', color: '#0e9f6e', icon: '🕌' };
  const aRead = { id: uid(), name: 'قراءة وتعلم', color: '#3b82f6', icon: '📚' };
  const aFit = { id: uid(), name: 'صحة ولياقة', color: '#f97316', icon: '💪' };

  const gHifz = { id: uid(), periodId: period.id, areaId: aDin.id, title: 'حفظ القرآن', unit: 'وجه', target: 120 };
  const gTilawa = { id: uid(), periodId: period.id, areaId: aDin.id, title: 'قراءة القرآن', unit: 'وجه', target: 604 };
  const gPoems = { id: uid(), periodId: period.id, areaId: aRead.id, title: 'حفظ قصائد', unit: 'قصيدة', target: 10 };
  const gBook = { id: uid(), periodId: period.id, areaId: aRead.id, title: 'نادي قراءة الكتاب', unit: 'كتاب', target: 6 };
  const gGym = { id: uid(), periodId: period.id, areaId: aFit.id, title: 'النادي', unit: 'جلسة', target: 100 };

  const routines = [
    { id: uid(), goalId: gHifz.id, title: 'ورد الحفظ اليومي', schedule: 'daily', qtyPerSession: 1, makeupPolicy: 'carry', createdAt: t },
    { id: uid(), goalId: gTilawa.id, title: 'الورد اليومي', schedule: 'daily', qtyPerSession: 4, makeupPolicy: 'carry', createdAt: t },
    { id: uid(), goalId: gTilawa.id, title: 'ورد إضافي', schedule: { perWeek: 3 }, qtyPerSession: 4, makeupPolicy: 'pace', createdAt: t },
    { id: uid(), goalId: gPoems.id, title: 'جلسة حفظ قصائد', schedule: { perWeek: 3 }, qtyPerSession: 0, makeupPolicy: 'pace', createdAt: t },
    { id: uid(), goalId: gBook.id, title: 'جلسة قراءة الكتاب', schedule: { perWeek: 4 }, qtyPerSession: 0, makeupPolicy: 'pace', createdAt: t },
    { id: uid(), goalId: gGym.id, title: 'جلسة الحديد', schedule: { perWeek: 3 }, qtyPerSession: 1, makeupPolicy: 'pace', createdAt: t },
    { id: uid(), goalId: gGym.id, title: 'تمرين كرة القدم', schedule: { perWeek: 1 }, qtyPerSession: 1, makeupPolicy: 'pace', createdAt: t },
  ];

  return {
    version: 1,
    migrations: { fitness1: true },
    periods: [period],
    areas: [aDin, aRead, aFit],
    goals: [gHifz, gTilawa, gPoems, gBook, gGym],
    routines,
    entries: [],
    reviews: [],
    settings: {
      theme: 'auto',
      activePeriodId: period.id,
      lastBackupDate: null,
      lastOpenedDate: t,
      installDate: t,
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
      persist();
      onDone(null);
    } catch (e) {
      onDone(e);
    }
  };
  reader.onerror = () => onDone(new Error('تعذرت قراءة الملف'));
  reader.readAsText(file);
}
