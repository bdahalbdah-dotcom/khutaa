// أدوات التواريخ: ميلادي أساسي + عرض هجري (أم القرى) + حسابات أسابيع تبدأ بالأحد

export const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const pad = (x) => String(x).padStart(2, '0');

export function fmtISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() {
  return fmtISO(new Date());
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return fmtISO(d);
}

export function dayOfWeek(iso) {
  return parseISO(iso).getDay(); // 0 = الأحد ... 6 = السبت
}

// بداية الأسبوع = الأحد
export function weekStartOf(iso) {
  return addDays(iso, -dayOfWeek(iso));
}

export function weekDates(weekStartIso) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartIso, i));
}

export function daysBetween(aIso, bIso) {
  return Math.round((parseISO(bIso) - parseISO(aIso)) / 86400000);
}

const numFmt = new Intl.NumberFormat('ar-SA');
export function n(x) {
  return numFmt.format(x);
}

const gregFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-arab', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
export function gregLong(iso) {
  return gregFmt.format(parseISO(iso));
}

const gregShortFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-arab', {
  day: 'numeric', month: 'short',
});
export function gregShort(iso) {
  return gregShortFmt.format(parseISO(iso));
}

const hijriFmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', {
  day: 'numeric', month: 'long', year: 'numeric',
});
export function hijriLong(iso) {
  try {
    return hijriFmt.format(parseISO(iso));
  } catch {
    return '';
  }
}

export function dayName(iso) {
  return DAY_NAMES[dayOfWeek(iso)];
}

export function isToday(iso) {
  return iso === todayISO();
}
