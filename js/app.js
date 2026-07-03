// التهيئة والتنقل وتسجيل الـ Service Worker

import { load, state, onChange } from './store.js';
import { backfill } from './engine.js';
import { todayISO, daysBetween } from './dates.js';
import { toast } from './ui.js';
import * as today from './views/today.js';
import * as week from './views/week.js';
import * as goals from './views/goals.js';
import * as stats from './views/stats.js';
import * as reviews from './views/reviews.js';
import * as settings from './views/settings.js';

const routes = { today, week, goals, stats, reviews, settings };
let current = 'today';

export function applyTheme() {
  const pref = state.settings.theme;
  const dark = pref === 'dark' || (pref === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

function rerender() {
  // عنصر جديد في كل رسم حتى لا تتراكم مستمعات الأحداث
  const old = document.getElementById('view');
  const fresh = old.cloneNode(false);
  old.replaceWith(fresh);
  routes[current].render(fresh);
  document.querySelectorAll('nav.bottom a').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === current);
  });
}

function route() {
  const hash = location.hash.replace('#', '') || 'today';
  current = routes[hash] ? hash : 'today';
  rerender();
}

// ---------- التشغيل ----------

load();
backfill();
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

window.addEventListener('hashchange', route);
onChange(rerender);
route();

// طلب تخزين دائم حتى لا يحذف النظام البيانات
if (navigator.storage?.persist) navigator.storage.persist();

// تذكير بالنسخ الاحتياطي إذا مضى أكثر من ٣٠ يومًا
{
  const last = state.settings.lastBackupDate;
  const installedFor = daysBetween(state.settings.installDate || todayISO(), todayISO());
  if ((last && daysBetween(last, todayISO()) > 30) || (!last && installedFor > 30)) {
    toast('مضى شهر بلا نسخة احتياطية — صدّر نسختك من الإعدادات', { sticky: true, action: 'حسنًا', onAction: () => { document.getElementById('toast').innerHTML = ''; } });
  }
}

// تسجيل Service Worker + إشعار التحديث
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('تحديث جديد متاح', {
            action: 'حدّث الآن', sticky: true,
            onAction: () => nw.postMessage({ type: 'SKIP_WAITING' }),
          });
        }
      });
    });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}

// إعادة رسم شاشة اليوم عند العودة للتطبيق في يوم جديد
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.settings.lastOpenedDate !== todayISO()) {
    backfill();
    rerender();
  }
});
