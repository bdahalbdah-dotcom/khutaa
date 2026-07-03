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
  return state;
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

  const gHifz = { id: uid(), periodId: period.id, areaId: aDin.id, title: 'حفظ القرآن', unit: 'وجه', target: 120 };
  const gTilawa = { id: uid(), periodId: period.id, areaId: aDin.id, title: 'قراءة القرآن', unit: 'وجه', target: 604 };
  const gPoems = { id: uid(), periodId: period.id, areaId: aRead.id, title: 'حفظ قصائد', unit: 'قصيدة', target: 10 };
  const gBook = { id: uid(), periodId: period.id, areaId: aRead.id, title: 'نادي قراءة الكتاب', unit: 'كتاب', target: 6 };

  const routines = [
    { id: uid(), goalId: gHifz.id, title: 'ورد الحفظ اليومي', schedule: 'daily', qtyPerSession: 1, makeupPolicy: 'carry', createdAt: t },
    { id: uid(), goalId: gTilawa.id, title: 'الورد اليومي', schedule: 'daily', qtyPerSession: 4, makeupPolicy: 'carry', createdAt: t },
    { id: uid(), goalId: gTilawa.id, title: 'ورد إضافي', schedule: { perWeek: 3 }, qtyPerSession: 4, makeupPolicy: 'pace', createdAt: t },
    { id: uid(), goalId: gPoems.id, title: 'جلسة حفظ قصائد', schedule: { perWeek: 3 }, qtyPerSession: 0, makeupPolicy: 'pace', createdAt: t },
    { id: uid(), goalId: gBook.id, title: 'جلسة قراءة الكتاب', schedule: { perWeek: 4 }, qtyPerSession: 0, makeupPolicy: 'pace', createdAt: t },
  ];

  return {
    version: 1,
    periods: [period],
    areas: [aDin, aRead],
    goals: [gHifz, gTilawa, gPoems, gBook],
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
