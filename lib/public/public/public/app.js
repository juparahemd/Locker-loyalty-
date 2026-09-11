let currentLang = 'en';

function setLang(lang) {
  currentLang = lang;
  document.getElementById('htmlRoot').setAttribute('lang', lang);
  document.getElementById('htmlRoot').setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

  document.getElementById('btnEn').classList.toggle('active', lang === 'en');
  document.getElementById('btnAr').classList.toggle('active', lang === 'ar');

  document.querySelectorAll('[data-en]').forEach((el) => {
    el.textContent = lang === 'ar' ? el.getAttribute('data-ar') : el.getAttribute('data-en');
  });

  const input = document.getElementById('queryInput');
  input.placeholder = lang === 'ar'
    ? input.getAttribute('data-ar-placeholder')
    : input.getAttribute('data-en-placeholder');
}

document.getElementById('searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const query = document.getElementById('queryInput').value.trim();
  const btn = document.getElementById('searchBtn');
  const box = document.getElementById('resultBox');

  if (!query) return;

  btn.disabled = true;
  box.className = 'result-box hidden';

  try {
    const resp = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
    const data = await resp.json();

    if (data.success) {
      box.className = 'result-box';
      box.innerHTML = `
        <div class="result-name">${escapeHtml(data.name)}</div>
        <div class="result-points">${data.points}</div>
        <div class="result-points-label">${currentLang === 'ar' ? 'نقطة' : 'POINTS'}</div>
      `;
    } else {
      box.className = 'result-box error';
      box.textContent = currentLang === 'ar' ? data.message_ar : data.message_en;
    }
  } catch (err) {
    box.className = 'result-box error';
    box.textContent = currentLang === 'ar'
      ? 'حدث خطأ. الرجاء المحاولة مرة أخرى.'
      : 'Something went wrong. Please try again.';
  } finally {
    btn.disabled = false;
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
