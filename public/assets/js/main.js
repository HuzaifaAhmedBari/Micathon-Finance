// =========================================
// HisaabPro — Shared App Logic
// =========================================

const HP_ACCOUNT_KEY = 'hisaabpro.account.v1';
const HP_SESSION_KEY = 'hisaabpro.session.v1';
function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function readAccount() {
  return safeJsonParse(localStorage.getItem(HP_ACCOUNT_KEY), {});
}

function writeAccount(account) {
  const merged = { ...readAccount(), ...account };
  localStorage.setItem(HP_ACCOUNT_KEY, JSON.stringify(merged));
  return merged;
}

function readPreferences() {
  return safeJsonParse(localStorage.getItem('hisaabpro.preferences.v1'), {});
}

function writePreferences(preferences) {
  const merged = { ...readPreferences(), ...preferences };
  localStorage.setItem('hisaabpro.preferences.v1', JSON.stringify(merged));
  return merged;
}

function setSession(account) {
  localStorage.setItem(HP_SESSION_KEY, JSON.stringify({
    email: account.email,
    loggedInAt: new Date().toISOString(),
  }));
}

function clearSession() {
  localStorage.removeItem(HP_SESSION_KEY);
}

function readSession() {
  return safeJsonParse(localStorage.getItem(HP_SESSION_KEY), null);
}

function hasActiveSession() {
  const session = readSession();
  const email = String(session && session.email ? session.email : '').trim();
  return email.length > 0;
}

function getDisplayName(account) {
  return [account.firstName, account.lastName].filter(Boolean).join(' ').trim() || account.storeName || '';
}

function getInitials(account) {
  const firstInitial = account.firstName ? account.firstName[0] : '';
  const lastInitial = account.lastName ? account.lastName[0] : '';
  if (firstInitial || lastInitial) return `${firstInitial}${lastInitial}`.toUpperCase();
  return (account.storeName || '').slice(0, 2).toUpperCase();
}

function syncAccountChrome() {
  const account = readAccount();
  const name = getDisplayName(account);
  const role = account.role || '';
  const initials = getInitials(account);

  document.querySelectorAll('.sidebar-user .user-name').forEach(el => {
    el.textContent = name;
  });
  document.querySelectorAll('.sidebar-user .user-role').forEach(el => {
    el.textContent = role;
  });
  document.querySelectorAll('.sidebar-user .user-avatar').forEach(el => {
    el.textContent = initials;
  });

  document.querySelectorAll('.profile-name').forEach(el => {
    el.textContent = name;
  });
  document.querySelectorAll('.profile-email').forEach(el => {
    el.textContent = account.email || '';
  });
  document.querySelectorAll('.profile-avatar-large').forEach(el => {
    el.textContent = initials;
  });

  const memberSince = document.getElementById('profileMemberSince');
  if (memberSince) {
    memberSince.textContent = account.memberSince || '—';
  }

  const totalEntries = document.getElementById('profileTotalEntries');
  if (totalEntries) {
    totalEntries.textContent = account.totalEntries != null ? String(account.totalEntries) : '—';
  }

  const streak = document.getElementById('profileStreak');
  if (streak) {
    streak.textContent = account.streak != null ? `🔥 ${account.streak} days` : '—';
  }

  const forecastAccuracy = document.getElementById('profileForecastAccuracy');
  if (forecastAccuracy) {
    forecastAccuracy.textContent = account.forecastAccuracy != null ? `${account.forecastAccuracy}%` : '—';
  }
}

window.HPAccount = {
  readAccount,
  readSession,
  writeAccount,
  readPreferences,
  writePreferences,
  setSession,
  clearSession,
  getDisplayName,
  getInitials,
  syncAccountChrome,
};

function enforceAuthRoute() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const publicPages = new Set(['login.html', 'register.html']);
  const isPublicPage = publicPages.has(currentPage);
  const authenticated = hasActiveSession();

  if (!authenticated && !isPublicPage) {
    window.location.replace('login.html');
    return false;
  }

  if (authenticated && isPublicPage) {
    window.location.replace('index.html');
    return false;
  }

  return true;
}

enforceAuthRoute();

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

document.addEventListener('DOMContentLoaded', () => {
  if (window.HPAccount) {
    window.HPAccount.syncAccountChrome();
  }
});

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
        amountEl.className = 'amount-value ' + (type === 'expense' ? 'coral' : 'emerald');
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
