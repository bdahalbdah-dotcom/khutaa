// تبويب المزيد: مدخل للشاشات الأقل استعمالًا (الإحصاء، المراجعات، الإعدادات)

const LINKS = [
  { hash: '#stats', icon: '📈', name: 'الإحصاء', desc: 'تقدّمك ونسب الالتزام وتوازن المجالات' },
  { hash: '#reviews', icon: '📝', name: 'المراجعات', desc: 'جلساتك الأسبوعية والشهرية' },
  { hash: '#settings', icon: '⚙️', name: 'الإعدادات', desc: 'أوقات اليوم والمجالات والفترات والنسخ الاحتياطي' },
];

export function render(el) {
  el.innerHTML = `
    <div class="page-head"><h1>المزيد</h1></div>
    ${LINKS.map((l) => `
      <a class="more-row" href="${l.hash}">
        <span class="ico">${l.icon}</span>
        <span class="body">
          <span class="name">${l.name}</span>
          <span class="desc">${l.desc}</span>
        </span>
        <span class="chev">‹</span>
      </a>`).join('')}
  `;
}
