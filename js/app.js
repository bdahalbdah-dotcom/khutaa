// التهيئة والتنقل وتسجيل الـ Service Worker

import { load, state, onChange, silently } from './store.js';
import { backfill } from './engine.js';
import { todayISO, daysBetween } from './dates.js';
import { toast, openModal } from './ui.js';
import { goalForm } from './views/goals.js';
import * as today from './views/today.js';
import * as week from './views/week.js';
import * as goals from './views/goals.js';
import * as stats from './views/stats.js';
import * as reviews from './views/reviews.js';
import * as settings from './views/settings.js';
import * as more from './views/more.js';
import { currentPartId } from './dayparts.js';

const routes = {
  today, week, goals, stats, reviews, settings, more,
};
// الشاشات الفرعية تُبرز تبويب «المزيد»
const NAV_OF = { stats: 'more', reviews: 'more', settings: 'more' };
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
  const navRoute = NAV_OF[current] || current;
  document.querySelectorAll('nav.bottom a').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === navRoute);
  });
}

function route() {
  const hash = location.hash.replace('#', '') || 'today';
  current = routes[hash] ? hash : 'today';
  rerender();
}

// شاشة ترحيب للمستخدم الجديد (تظهر مرة واحدة فقط، ولا تظهر لمن لديه أهداف)
function maybeWelcome() {
  if (state.settings.onboarded) return;
  if (state.goals.length) {
    silently((s) => { s.settings.onboarded = true; });
    return;
  }
  const modal = openModal(`
    <div class="center" style="padding:10px 4px">
      <div style="font-size:3rem">🌱</div>
      <h2>أهلًا بك في خُطى</h2>
      <p class="muted" style="margin-bottom:14px">خطوات صغيرة كل يوم… تصنع أهدافًا كبيرة.</p>
      <div style="text-align:start;font-size:.9rem;line-height:2">
        🎯 حدد <b>هدفًا كبيرًا</b> لفترتك (نصف سنة أو سنة) برقم تطمح له<br>
        🔁 اربطه <b>بورد متكرر</b>: يومي، أيام محددة، أو مرات مرنة بالأسبوع<br>
        ☀️ وشاشة <b>اليوم</b> ترتب لك خطواتك تلقائيًا وتحسب تقدمك
      </div>
      <div class="actions" style="margin-top:18px">
        <button class="btn" id="wStart">🎯 أنشئ هدفك الأول</button>
        <button class="btn secondary" id="wSkip">أستكشف بنفسي</button>
      </div>
    </div>
  `);
  const done = () => {
    silently((s) => { s.settings.onboarded = true; });
    modal.remove();
  };
  modal.querySelector('#wStart').addEventListener('click', () => {
    done();
    location.hash = '#goals';
    goalForm(null);
  });
  modal.querySelector('#wSkip').addEventListener('click', done);
}

// ---------- التشغيل ----------

load();
backfill();
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

window.addEventListener('hashchange', route);
onChange(rerender);
route();
maybeWelcome();

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

// إعادة الرسم عند تغيّر اليوم أو تغيّر فترة اليوم — حتى لا يبقى وسم «الآن» على فترة فائتة
let seenPart = currentPartId();

function refreshIfStale() {
  const newDay = state.settings.lastOpenedDate !== todayISO();
  const newPart = currentPartId() !== seenPart;
  if (!newDay && !newPart) return;
  seenPart = currentPartId();
  if (newDay) backfill();
  rerender();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshIfStale();
});

setInterval(refreshIfStale, 60000);
