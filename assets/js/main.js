// =========================================
// HisaabPro — Shared App Logic
// =========================================

// ---- Sidebar Toggle (Mobile) ----
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');
const menuBtn = document.getElementById('menuBtn');

if (menuBtn) {
  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  });
}
if (overlay) {
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });
}

// ---- Active Nav Item ----
function setActiveNav() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item').forEach(item => {
    const href = item.getAttribute('href');
    if (href && href === currentPage) {
      item.classList.add('active');
    }
  });
  document.querySelectorAll('.mobile-nav-tab').forEach(tab => {
    const href = tab.getAttribute('href');
    if (href && href === currentPage) {
      tab.classList.add('active');
      const dot = tab.querySelector('.mobile-nav-dot');
      if (!dot) {
        const d = document.createElement('div');
        d.className = 'mobile-nav-dot';
        tab.appendChild(d);
      }
    }
  });
}
document.addEventListener('DOMContentLoaded', setActiveNav);

// ---- Dynamic Date ----
function setCurrentDate() {
  const el = document.getElementById('currentDate');
  if (el) {
    const now = new Date();
    el.textContent = now.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
}
document.addEventListener('DOMContentLoaded', setCurrentDate);

// ---- Filter Chips ----
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.filter-chip[data-group]').forEach(chip => {
    chip.addEventListener('click', function () {
      const group = this.dataset.group;
      document.querySelectorAll(`.filter-chip[data-group="${group}"]`).forEach(c => c.classList.remove('active'));
      this.classList.add('active');
    });
  });
});

// ---- Toggle Switch ----
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const parent = this.closest('.toggle-switch');
      parent.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active-emerald', 'active-coral'));
      const type = this.dataset.type;
      this.classList.add(type === 'expense' ? 'active-coral' : 'active-emerald');

      // Change page-level accent if on the log page
      const amountEl = document.getElementById('amountDisplay');
      if (amountEl) {
        amountEl.className = 'kpi-value ' + (type === 'expense' ? 'coral' : 'emerald');
      }
      const submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        if (type === 'expense') {
          submitBtn.textContent = 'Save Kharcha (Expense)';
          submitBtn.className = 'btn btn-pill-lg btn-danger';
        } else {
          submitBtn.textContent = 'Save Bikri (Sale)';
          submitBtn.className = 'btn btn-pill-lg btn-primary';
        }
      }
    });
  });
});

// ---- Numpad logic (log page) ----
let currentAmount = '';
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.numpad-key').forEach(key => {
    key.addEventListener('click', function () {
      const val = this.dataset.val;
      const display = document.getElementById('amountDisplay');
      if (!display) return;
      if (val === 'back') {
        currentAmount = currentAmount.slice(0, -1);
      } else if (val === '.' && currentAmount.includes('.')) {
        return;
      } else {
        if (currentAmount.length >= 9) return;
        currentAmount += val;
      }
      const num = parseFloat(currentAmount) || 0;
      display.textContent = 'PKR ' + (currentAmount === '' ? '0' : num.toLocaleString('en-PK'));
    });
  });
});

// ---- Password Toggle ----
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', function () {
      const input = this.closest('.input-group').querySelector('input');
      if (input.type === 'password') {
        input.type = 'text';
        this.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
      } else {
        input.type = 'password';
        this.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
      }
    });
  });
});
