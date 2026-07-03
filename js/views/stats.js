// شاشة الإحصائيات: تقدم الأهداف، توازن المجالات، الالتزام، منحنى الأسابيع

import { state } from '../store.js';
import {
  activePeriod, periodGoals, paceInfo, goalDoneQty, commitment,
  weeklyTrend, areaBalance, goalById, areaOf,
} from '../engine.js';
import { gregShort, n } from '../dates.js';
import { esc, progressBar } from '../ui.js';

function trendChart(data) {
  if (!data.length) return '<div class="empty">لا بيانات بعد</div>';
  const max = Math.max(...data.map((d) => d.count), 1);
  const W = 600; const H = 180; const pad = 8;
  const bw = Math.min((W - pad * 2) / data.length - 4, 40);
  const bars = data.map((d, i) => {
    const h = (d.count / max) * (H - 50);
    const x = W - pad - (i + 1) * (bw + 4); // من اليمين لليسار (RTL)
    return `
      <rect x="${x}" y="${H - 30 - h}" width="${bw}" height="${Math.max(h, 2)}" rx="4"
        fill="${d.count ? 'var(--accent)' : 'var(--card2)'}"/>
      <text x="${x + bw / 2}" y="${H - 34 - h}" text-anchor="middle" font-size="11" fill="var(--muted)">${d.count ? n(d.count) : ''}</text>
      <text x="${x + bw / 2}" y="${H - 12}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${esc(gregShort(d.weekStart))}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}">${bars}</svg>`;
}

export function render(el) {
  const p = activePeriod();
  const goals = periodGoals(p);
  const balance = areaBalance().filter((b) => b.count > 0);
  const totalBalance = balance.reduce((s, b) => s + b.count, 0);
  const trend = weeklyTrend();
  const routines = state.routines.filter((r) => {
    const g = goalById(r.goalId);
    return g && p && g.periodId === p.id;
  });

  el.innerHTML = `
    <div class="page-head">
      <h1>الإحصائيات</h1>
      <div class="dates">${p ? esc(p.name) : ''}</div>
    </div>

    <div class="section-title">تقدم الأهداف <span class="muted small">(العلامة الرمادية = المتوقع الآن)</span></div>
    ${goals.map((g) => {
      const pi = paceInfo(g);
      const done = goalDoneQty(g);
      return `<div class="card" style="padding:10px 14px">
        <div style="display:flex;justify-content:space-between">
          <b>${esc(g.title)}</b>
          <span class="small">${g.target ? `${n(done)} / ${n(g.target)} ${esc(g.unit)}` : `${n(done)} ${esc(g.unit)}`}</span>
        </div>
        ${g.target ? progressBar(pi.pct, pi.expectedPct) : ''}
        ${pi ? `<span class="pace ${pi.status}">${pi.status === 'ahead' ? 'متقدم 🚀' : pi.status === 'on' ? 'على المسار ✓' : `متأخر — يلزمك ${n(Math.ceil(pi.neededPerWeek))} ${esc(g.unit)} أسبوعيًا`}</span>` : ''}
      </div>`;
    }).join('') || '<div class="empty">لا أهداف</div>'}

    <div class="section-title">نسبة الالتزام بالأوراد</div>
    ${routines.map((r) => {
      const c = commitment(r);
      const g = goalById(r.goalId);
      if (!c) return `<div class="card" style="padding:10px 14px"><b>${esc(r.title)}</b><div class="muted small">${esc(g.title)} · لا بيانات كافية بعد</div></div>`;
      return `<div class="card" style="padding:10px 14px">
        <div style="display:flex;justify-content:space-between">
          <b>${esc(r.title)}</b>
          <span class="small">${n(Math.round(c.pct * 100))}٪ <span class="muted">(${n(c.done)}/${n(c.total)} ${c.kind === 'weeks' ? 'أسبوعًا' : 'يومًا'})</span></span>
        </div>
        ${progressBar(c.pct)}
      </div>`;
    }).join('') || '<div class="empty">لا أوراد</div>'}

    <div class="section-title">توازن المجالات <span class="muted small">(عدد الإنجازات)</span></div>
    <div class="card">
      ${balance.length ? balance.map((b) => `
        <div style="display:flex;justify-content:space-between;font-size:.84rem">
          <span>${esc(b.area.icon || '')} ${esc(b.area.name)}</span>
          <b>${n(b.count)} · ${n(Math.round((b.count / totalBalance) * 100))}٪</b>
        </div>
        <div class="bar"><div class="fill" style="width:${(b.count / totalBalance) * 100}%;background:${b.area.color}"></div></div>
      `).join('') : '<div class="empty">أنجز خطواتك الأولى لترى التوازن</div>'}
    </div>

    <div class="section-title">إنجازات الأسابيع عبر الفترة</div>
    <div class="card chart-card">${trendChart(trend)}</div>
  `;
}
