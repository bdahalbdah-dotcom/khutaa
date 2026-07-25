// فترات اليوم: أوقات تقريبية مرتبطة بالصلوات، قابلة للتعديل من الإعدادات (بلا إنترنت ولا API مواقيت)

import { state } from './store.js';

export const DEFAULT_PARTS = [
  { id: 'fajr', name: 'الفجر', icon: '🌄', start: '04:45' },
  { id: 'duha', name: 'الضحى', icon: '☀️', start: '07:30' },
  { id: 'dhuhr', name: 'الظهر', icon: '🕛', start: '12:00' },
  { id: 'asr', name: 'العصر', icon: '🌇', start: '15:00' },
  { id: 'maghrib', name: 'المغرب', icon: '🌆', start: '18:15' },
  { id: 'isha', name: 'العشاء', icon: '🌙', start: '19:45' },
  { id: 'night', name: 'قبل النوم', icon: '🛏️', start: '22:30' },
];

// مجموعة اصطناعية لما لا وقت له — تُعرض في آخر اليوم
export const ANY_PART = { id: '_any', name: 'أي وقت', icon: '⏱', start: null };

const pad = (x) => String(x).padStart(2, '0');

export function toMinutes(hm) {
  const [h, m] = String(hm).split(':').map(Number);
  return h * 60 + m;
}

// عرض الوقت بأرقام عربية (٣:٠٠ م)
const timeFmt = new Intl.DateTimeFormat('ar-SA-u-nu-arab', { hour: 'numeric', minute: '2-digit' });
export function fmtTime(hm) {
  if (!hm) return '';
  const [h, m] = String(hm).split(':').map(Number);
  return timeFmt.format(new Date(2000, 0, 1, h, m));
}

export function nowHM() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// فترات الإعدادات مرتّبة زمنيًا (مع احتياط إن غابت)
export function parts() {
  const list = state?.settings?.dayParts?.length ? state.settings.dayParts : DEFAULT_PARTS;
  return [...list].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

export function partById(id) {
  if (id === ANY_PART.id) return ANY_PART;
  return parts().find((p) => p.id === id) || null;
}

// الفترة الحاوية لوقت معيّن — الفترة الأخيرة تمتد عبر منتصف الليل إلى أول فترة
export function partAt(hm) {
  const list = parts();
  const mins = toMinutes(hm);
  let found = list[list.length - 1]; // قبل أول فترة = امتداد فترة الليل
  for (const p of list) {
    if (mins >= toMinutes(p.start)) found = p;
  }
  return found;
}

export function currentPartId() {
  return partAt(nowHM()).id;
}

// مدى الفترة نصًّا: «٣:٣٠ م — ٦:١٥ م»
export function partRange(part) {
  if (!part || part.id === ANY_PART.id) return '';
  const list = parts();
  const i = list.findIndex((p) => p.id === part.id);
  const next = list[(i + 1) % list.length];
  return `${fmtTime(part.start)} — ${fmtTime(next.start)}`;
}

// تجميع بنود اليوم حسب الفترة، مرتّبة زمنيًا، وداخل كل فترة بالساعة ثم ترتيب الإدخال
export function groupByPart(items) {
  const buckets = new Map(parts().map((p) => [p.id, []]));
  const any = [];
  for (const it of items) {
    const id = it.entry?.partId ?? it.partId ?? it.routine?.partId ?? null;
    const list = id && buckets.has(id) ? buckets.get(id) : any;
    list.push(it);
  }
  const atOf = (it) => it.entry?.at ?? it.at ?? it.routine?.at ?? null;
  const byTime = (a, b) => {
    const x = atOf(a);
    const y = atOf(b);
    if (x && y) return toMinutes(x) - toMinutes(y);
    if (x) return -1;
    if (y) return 1;
    return 0;
  };
  const out = parts().map((part) => ({ part, items: buckets.get(part.id).sort(byTime) }));
  out.push({ part: ANY_PART, items: any });
  return out;
}
