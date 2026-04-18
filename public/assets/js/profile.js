// =========================================
// HisaabPro — Profile Page Logic
// =========================================

function getProfileApi() {
  return window.HPAccount;
}

function setProfileStatus(message, type = 'success') {
  const status = document.getElementById('profileStatus');
  if (!status) return;
  status.style.display = 'block';
  status.className = `alert alert-${type === 'success' ? 'success' : 'danger'}`;
  status.textContent = message;
}

function hideProfileStatus() {
  const status = document.getElementById('profileStatus');
  if (!status) return;
  status.style.display = 'none';
  status.textContent = '';
}

function applyToggleVisual(toggleInput) {
  const label = toggleInput.closest('label');
  if (!label) return;
  const spans = label.querySelectorAll('span');
  const track = spans[0];
  const thumb = spans[1];
  const enabled = toggleInput.checked;

  if (track) {
    track.style.background = enabled ? 'var(--emerald)' : 'var(--border)';
  }
  if (thumb) {
    thumb.style.transform = enabled ? 'translateX(20px)' : 'translateX(0)';
  }
}

function setReadonly(inputs, readonly) {
  inputs.forEach(input => {
    input.readOnly = readonly;
    input.style.cursor = readonly ? 'default' : 'text';
    input.style.background = readonly ? 'var(--canvas)' : 'var(--surface)';
  });
}

function syncProfileFields(account, preferences) {
  document.getElementById('profileFirstName').value = account.firstName || '';
  document.getElementById('profileLastName').value = account.lastName || '';
  document.getElementById('profileEmail').value = account.email || '';
  document.getElementById('profilePhone').value = account.phone || '';
  document.getElementById('profileStoreName').value = account.storeName || '';
  document.getElementById('profileCity').value = account.city || '';
  document.getElementById('profileArea').value = account.area || '';

  const lowStock = document.getElementById('prefLowStockAlerts');
  const dailySummary = document.getElementById('prefDailySummary');
  const forecastUpdates = document.getElementById('prefForecastUpdates');

  if (lowStock) {
    lowStock.checked = Boolean(preferences.lowStockAlerts);
    applyToggleVisual(lowStock);
  }
  if (dailySummary) {
    dailySummary.checked = Boolean(preferences.dailySummary);
    applyToggleVisual(dailySummary);
  }
  if (forecastUpdates) {
    forecastUpdates.checked = Boolean(preferences.forecastUpdates);
    applyToggleVisual(forecastUpdates);
  }
}

function setActiveProfileSection(section) {
  document.querySelectorAll('.profile-nav-item[data-section]').forEach(item => {
    item.classList.toggle('active', item.dataset.section === section);
  });

  document.querySelectorAll('.profile-panel[data-section]').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.section === section);
  });
}

function setupProfileTabs() {
  const navItems = document.querySelectorAll('.profile-nav-item[data-section]');
  if (!navItems.length) return;

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section || 'personal';
      setActiveProfileSection(section);
    });
  });
}

function clearPasswordInputs() {
  const current = document.getElementById('currentPassword');
  const next = document.getElementById('newPassword');
  const confirm = document.getElementById('confirmPasswordProfile');
  if (current) current.value = '';
  if (next) next.value = '';
  if (confirm) confirm.value = '';
}

function resetLocalAccount(accountApi) {
  localStorage.removeItem('hisaabpro.account.v1');
  localStorage.removeItem('hisaabpro.preferences.v1');
  localStorage.removeItem('hisaabpro.session.v1');
  localStorage.removeItem('hisaabpro.remember.v1');
  accountApi.syncAccountChrome();
}

function getSupabaseClient() {
  if (!window.supabase) return null;
  const config = window.supabase._config || {};
  if (!config.url || !config.anonKey) return null;
  return window.supabase;
}

function sanitizeEmail(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

async function hashPasswordSha256(password) {
  const normalized = String(password || '');
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('Secure hashing is unavailable in this browser context.');
  }

  const encoder = new TextEncoder();
  const bytes = encoder.encode(normalized);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  const accountApi = getProfileApi();
  if (!accountApi) return;
  setupProfileTabs();
  setActiveProfileSection('personal');

  const hydrateFromDb = async () => {
    const account = accountApi.readAccount();
    const client = getSupabaseClient();
    const userEmail = sanitizeEmail(account.email || '');

    if (!client || !userEmail) {
      syncProfileFields(account, accountApi.readPreferences());
      return;
    }

    const { data, error } = await client
      .from('demo_public_users')
      .select('*')
      .eq('email', userEmail);

    if (error || !Array.isArray(data) || data.length === 0) {
      syncProfileFields(account, accountApi.readPreferences());
      return;
    }

    const row = data[0];
    const updatedAccount = accountApi.writeAccount({
      firstName: row.first_name || '',
      lastName: row.last_name || '',
      storeName: row.store_name || '',
      phone: row.phone || '',
      city: row.city || '',
      area: row.area || '',
      role: row.role || 'Store Owner',
      email: row.email || account.email || '',
    });

    const updatedPrefs = accountApi.writePreferences({
      lowStockAlerts: row.pref_low_stock_alerts !== false,
      dailySummary: row.pref_daily_summary !== false,
      forecastUpdates: row.pref_forecast_updates === true,
    });

    syncProfileFields(updatedAccount, updatedPrefs);
    accountApi.syncAccountChrome();
  };

  hydrateFromDb();

  const personalFields = [
    document.getElementById('profileFirstName'),
    document.getElementById('profileLastName'),
    document.getElementById('profileEmail'),
    document.getElementById('profilePhone'),
  ].filter(Boolean);

  const storeFields = [
    document.getElementById('profileStoreName'),
    document.getElementById('profileCity'),
    document.getElementById('profileArea'),
  ].filter(Boolean);

  setReadonly(personalFields, true);
  setReadonly(storeFields, true);

  const personalBtn = document.getElementById('editPersonalBtn');
  let editingPersonal = false;
  if (personalBtn) {
    personalBtn.addEventListener('click', async () => {
      hideProfileStatus();
      editingPersonal = !editingPersonal;
      setReadonly(personalFields, !editingPersonal);
      personalBtn.innerHTML = editingPersonal ? 'Save Personal Info' : '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>Edit';

      if (!editingPersonal) {
        const previousEmail = sanitizeEmail(accountApi.readAccount().email || '');
        const updatedAccount = accountApi.writeAccount({
          firstName: document.getElementById('profileFirstName').value.trim(),
          lastName: document.getElementById('profileLastName').value.trim(),
          email: sanitizeEmail(document.getElementById('profileEmail').value),
          phone: document.getElementById('profilePhone').value.trim(),
        });
        const client = getSupabaseClient();
        if (client && previousEmail) {
          const result = await client
            .from('demo_public_users')
            .eq('email', previousEmail)
            .update({
              first_name: updatedAccount.firstName,
              last_name: updatedAccount.lastName,
              phone: updatedAccount.phone,
              email: updatedAccount.email,
            });
          if (result.error) {
            setProfileStatus(result.error.message || 'Could not save personal information to demo table.', 'danger');
            return;
          }
        }
        if (updatedAccount.email && updatedAccount.email !== previousEmail) {
          accountApi.setSession(updatedAccount);
        }
        accountApi.syncAccountChrome();
        setProfileStatus('Personal information saved.', 'success');
      }
    });
  }

  const storeBtn = document.getElementById('editStoreBtn');
  let editingStore = false;
  if (storeBtn) {
    storeBtn.addEventListener('click', async () => {
      hideProfileStatus();
      editingStore = !editingStore;
      setReadonly(storeFields, !editingStore);
      storeBtn.innerHTML = editingStore ? 'Save Store Details' : '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>Edit';

      if (!editingStore) {
        const currentEmail = sanitizeEmail(accountApi.readAccount().email || '');
        const updatedAccount = accountApi.writeAccount({
          storeName: document.getElementById('profileStoreName').value.trim(),
          city: document.getElementById('profileCity').value.trim(),
          area: document.getElementById('profileArea').value.trim(),
        });
        const client = getSupabaseClient();
        if (client && currentEmail) {
          const result = await client
            .from('demo_public_users')
            .eq('email', currentEmail)
            .update({
              store_name: updatedAccount.storeName,
              city: updatedAccount.city,
              area: updatedAccount.area,
            });
          if (result.error) {
            setProfileStatus(result.error.message || 'Could not save store details to demo table.', 'danger');
            return;
          }
        }
        accountApi.syncAccountChrome();
        setProfileStatus('Store details saved.', 'success');
      }
    });
  }

  document.querySelectorAll('#prefLowStockAlerts, #prefDailySummary, #prefForecastUpdates').forEach(input => {
    input.addEventListener('change', async () => {
      const prefs = accountApi.writePreferences({
        lowStockAlerts: document.getElementById('prefLowStockAlerts').checked,
        dailySummary: document.getElementById('prefDailySummary').checked,
        forecastUpdates: document.getElementById('prefForecastUpdates').checked,
      });

      const client = getSupabaseClient();
      const currentEmail = sanitizeEmail(accountApi.readAccount().email || '');
      if (client && currentEmail) {
        const result = await client
          .from('demo_public_users')
          .eq('email', currentEmail)
          .update({
            pref_low_stock_alerts: prefs.lowStockAlerts,
            pref_daily_summary: prefs.dailySummary,
            pref_forecast_updates: prefs.forecastUpdates,
          });

        if (result.error) {
          setProfileStatus(result.error.message || 'Could not save notification preferences.', 'danger');
          return;
        }
      }

      applyToggleVisual(input);
      setProfileStatus('Notification preferences saved.', 'success');
    });
    applyToggleVisual(input);
  });

  const updatePasswordBtn = document.getElementById('updatePasswordBtn');
  if (updatePasswordBtn) {
    updatePasswordBtn.addEventListener('click', async event => {
      event.preventDefault();
      hideProfileStatus();

      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPasswordProfile').value;
      const currentAccount = accountApi.readAccount();

      if (!currentPassword || !newPassword || !confirmPassword) {
        setProfileStatus('Fill in all password fields first.', 'danger');
        return;
      }

      if (currentPassword !== currentAccount.password) {
        setProfileStatus('Current password is incorrect.', 'danger');
        return;
      }

      if (newPassword.length < 8) {
        setProfileStatus('New password must be at least 8 characters long.', 'danger');
        return;
      }

      if (newPassword !== confirmPassword) {
        setProfileStatus('New password and confirmation do not match.', 'danger');
        return;
      }

      const client = getSupabaseClient();
      const currentEmail = sanitizeEmail(currentAccount.email || '');
      if (client && currentEmail) {
        let passwordHash = '';
        try {
          passwordHash = await hashPasswordSha256(newPassword);
        } catch (error) {
          setProfileStatus(error.message || 'Could not securely process password.', 'danger');
          return;
        }
        const result = await client
          .from('demo_public_users')
          .eq('email', currentEmail)
          .update({ demo_password_hash: passwordHash });
        if (result.error) {
          setProfileStatus(result.error.message || 'Could not update password in demo table.', 'danger');
          return;
        }
      }

      accountApi.writeAccount({ password: newPassword });
      clearPasswordInputs();
      setProfileStatus('Password updated successfully.', 'success');
    });
  }

  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async event => {
      event.preventDefault();
      const confirmed = window.confirm('Delete this local account and reset the app data?');
      if (!confirmed) return;

      resetLocalAccount(accountApi);
      window.location.href = 'register.html';
    });
  }

  const signOutNavItem = document.getElementById('signOutNavItem');
  if (signOutNavItem) {
    signOutNavItem.addEventListener('click', async event => {
      event.preventDefault();
      accountApi.clearSession();
      window.location.href = 'login.html';
    });
  }
});
