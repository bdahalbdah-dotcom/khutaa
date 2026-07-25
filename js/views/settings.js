// شاشة الإعدادات: المظهر، النسخ الاحتياطي، المجالات، الفترات

import { state, update, uid, exportJSON, importJSON } from '../store.js';
import { todayISO, daysBetween, gregShort, n } from '../dates.js';
import { esc, openModal, closeModal, toast } from '../ui.js';
import { applyTheme } from '../app.js';
import { parts, DEFAULT_PARTS, toMinutes } from '../dayparts.js';

export function areaForm(area) {
  const isNew = !area;
  const modal = openModal(`
    <h2>${isNew ? 'مجال جديد' : 'تعديل المجال'}</h2>
    <form id="aForm">
      <div class="row">
        <label class="field">الاسم
          <input type="text" name="name" required value="${esc(area?.name || '')}" placeholder="مثال: صحة ولياقة">
        </label>
        <label class="field">أيقونة (رمز)
          <input type="text" name="icon" value="${esc(area?.icon || '')}" placeholder="💪">
        </label>
      </div>
      <label class="field">اللون
        <input type="color" name="color" value="${area?.color || '#0f766e'}" style="height:44px">
      </label>
      <div class="actions">
        <button class="btn" type="submit">${isNew ? 'إضافة' : 'حفظ'}</button>
        ${!isNew ? '<button class="btn danger" type="button" id="delA">حذف</button>' : ''}
      </div>
    </form>
  `);
  modal.querySelector('#aForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    update((s) => {
      if (isNew) s.areas.push({ id: uid(), name: f.name.value.trim(), icon: f.icon.value.trim(), color: f.color.value });
      else Object.assign(s.areas.find((a) => a.id === area.id), { name: f.name.value.trim(), icon: f.icon.value.trim(), color: f.color.value });
    });
    closeModal(modal.querySelector('.modal'));
  });
  modal.querySelector('#delA')?.addEventListener('click', () => {
    if (state.goals.some((g) => g.areaId === area.id)) {
      toast('انقل أهداف هذا المجال أولًا');
      return;
    }
    update((s) => { s.areas = s.areas.filter((a) => a.id !== area.id); });
    closeModal(modal.querySelector('.modal'));
  });
}

function periodForm(period) {
  const isNew = !period;
  const t = todayISO();
  const year = Number(t.slice(0, 4));
  const modal = openModal(`
    <h2>${isNew ? 'فترة جديدة' : 'تعديل الفترة'}</h2>
    <form id="pForm">
      <label class="field">اسم الفترة
        <input type="text" name="name" required value="${esc(period?.name || '')}" placeholder="مثال: النصف الأول ${year + 1}">
      </label>
      <div class="row">
        <label class="field">البداية
          <input type="date" name="start" required value="${period?.startDate || ''}">
        </label>
        <label class="field">النهاية
          <input type="date" name="end" required value="${period?.endDate || ''}">
        </label>
      </div>
      <div class="actions"><button class="btn" type="submit">${isNew ? 'إضافة وتفعيل' : 'حفظ'}</button></div>
    </form>
  `);
  modal.querySelector('#pForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.end.value <= f.start.value) { toast('النهاية يجب أن تكون بعد البداية'); return; }
    const days = daysBetween(f.start.value, f.end.value) + 1;
    const data = {
      name: f.name.value.trim(),
      startDate: f.start.value,
      endDate: f.end.value,
      type: days > 240 ? 'year' : 'half',
    };
    update((s) => {
      if (isNew) {
        const p = { id: uid(), ...data };
        s.periods.push(p);
        s.settings.activePeriodId = p.id;
      } else {
        Object.assign(s.periods.find((x) => x.id === period.id), data);
      }
    });
    closeModal(modal.querySelector('.modal'));
  });
}

export function render(el) {
  const s = state.settings;
  const backupAge = s.lastBackupDate ? daysBetween(s.lastBackupDate, todayISO()) : null;

  el.innerHTML = `
    <div class="page-head"><h1>الإعدادات</h1></div>

    <div class="card">
      <h2>المظهر</h2>
      <select id="theme">
        <option value="auto" ${s.theme === 'auto' ? 'selected' : ''}>تلقائي (حسب النظام)</option>
        <option value="light" ${s.theme === 'light' ? 'selected' : ''}>فاتح</option>
        <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>داكن</option>
      </select>
    </div>

    <div class="card">
      <h2>النسخ الاحتياطي</h2>
      <p class="muted small">بياناتك محفوظة على جهازك فقط. صدّر نسخة دوريًا لتأمينها.</p>
      ${backupAge == null ? '<p class="pace behind" style="margin:4px 0">لم تصدّر نسخة احتياطية بعد</p>'
        : backupAge > 30 ? `<p class="pace behind" style="margin:4px 0">آخر نسخة قبل ${n(backupAge)} يومًا — حان وقت التصدير</p>`
        : `<p class="muted small">آخر نسخة: قبل ${n(backupAge)} يومًا</p>`}
      <div class="row" style="margin-top:8px">
        <button class="btn" id="exportBtn">تصدير نسخة</button>
        <button class="btn secondary" id="importBtn">استيراد نسخة</button>
      </div>
      <input type="file" id="importFile" accept=".json,application/json" hidden>
    </div>

    <div class="card">
      <h2>أوقات اليوم</h2>
      <p class="muted small">أوقات تقريبية لترتيب أورادك — عدّلها بما يناسب مواقيتك. تمتد كل فترة إلى بداية التي تليها.</p>
      ${parts().map((p) => `
        <div class="part-time">
          <span class="ico">${p.icon}</span>
          <span class="nm">${esc(p.name)}</span>
          <input type="time" data-part="${p.id}" value="${esc(p.start)}">
        </div>`).join('')}
      <button class="btn ghost small" id="resetParts">إعادة الأوقات الافتراضية</button>
    </div>

    <div class="card">
      <h2>مجالات الحياة</h2>
      ${state.areas.map((a) => `
        <div class="mini-item">
          <span class="mark" style="background:${a.color}"></span>
          ${esc(a.icon || '')} ${esc(a.name)}
          <button class="x" data-area="${a.id}">✎</button>
        </div>`).join('')}
      <button class="btn ghost small" id="addArea">+ مجال جديد</button>
    </div>

    <div class="card">
      <h2>الفترات</h2>
      ${state.periods.map((p) => `
        <div class="mini-item">
          <span class="mark" style="background:${p.id === s.activePeriodId ? 'var(--accent)' : 'var(--line)'}"></span>
          ${esc(p.name)} <span class="muted small">· ${gregShort(p.startDate)} ← ${gregShort(p.endDate)}</span>
          ${p.id !== s.activePeriodId ? `<button class="x" data-activate="${p.id}" title="تفعيل">◉</button>` : ''}
          <button class="x" data-period="${p.id}">✎</button>
        </div>`).join('')}
      <button class="btn ghost small" id="addPeriod">+ فترة جديدة</button>
    </div>

    <div class="card center muted small">
      خُطى — خطوات صغيرة لأهداف كبيرة<br>
      يعمل بدون إنترنت · بياناتك على جهازك فقط
    </div>
  `;

  el.querySelector('#theme').addEventListener('change', (e) => {
    update((st) => { st.settings.theme = e.target.value; });
    applyTheme();
  });

  // تغيير وقت فترة: يُحفظ فورًا وتُعاد الفترات مرتّبة زمنيًا
  el.querySelectorAll('input[data-part]').forEach((inp) => {
    inp.addEventListener('change', () => {
      if (!inp.value) { inp.value = state.settings.dayParts.find((p) => p.id === inp.dataset.part).start; return; }
      update((st) => {
        const p = st.settings.dayParts.find((x) => x.id === inp.dataset.part);
        if (p) p.start = inp.value;
        st.settings.dayParts.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
      });
    });
  });

  el.querySelector('#resetParts').addEventListener('click', () => {
    update((st) => { st.settings.dayParts = DEFAULT_PARTS.map((p) => ({ ...p })); });
    toast('أُعيدت الأوقات الافتراضية');
  });

  el.querySelector('#exportBtn').addEventListener('click', () => {
    exportJSON();
    toast('صُدّرت النسخة الاحتياطية ✓');
  });
  el.querySelector('#importBtn').addEventListener('click', () => el.querySelector('#importFile').click());
  el.querySelector('#importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('الاستيراد سيستبدل كل البيانات الحالية. متابعة؟')) return;
    importJSON(file, (err) => {
      if (err) toast('فشل الاستيراد: ملف غير صالح');
      else location.reload();
    });
  });

  el.onclick = (ev) => {
    const tgt = ev.target;
    if (tgt.id === 'addArea') return areaForm(null);
    if (tgt.id === 'addPeriod') return periodForm(null);
    const a = tgt.closest('[data-area]');
    if (a) return areaForm(state.areas.find((x) => x.id === a.dataset.area));
    const p = tgt.closest('[data-period]');
    if (p) return periodForm(state.periods.find((x) => x.id === p.dataset.period));
    const act = tgt.closest('[data-activate]');
    if (act) {
      update((st) => { st.settings.activePeriodId = act.dataset.activate; });
      toast('فُعّلت الفترة');
    }
  };
}
