// =========================================
// HisaabPro — Auth Page Logic (Demo Table Mode)
// =========================================

function getAuthApi() {
  return window.HPAccount;
}

function getSupabaseClient() {
  if (!window.supabase) return null;
  const config = window.supabase._config || {};
  if (!config.url || !config.anonKey) return null;
  return window.supabase;
}

function toTitleCase(value) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function sanitizeEmail(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

function isValidEmail(value) {
  const email = sanitizeEmail(value);
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
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

function toAccountFromDemoUser(demoUser, password, fallbackAccount) {
  const createdAt = demoUser && demoUser.created_at
    ? new Date(demoUser.created_at)
    : new Date();

  return {
    ...fallbackAccount,
    firstName: demoUser.first_name || fallbackAccount.firstName || 'Demo',
    lastName: demoUser.last_name || fallbackAccount.lastName || 'User',
    storeName: demoUser.store_name || fallbackAccount.storeName || 'Demo Store',
    phone: demoUser.phone || fallbackAccount.phone || '',
    city: demoUser.city || fallbackAccount.city || '',
    area: demoUser.area || fallbackAccount.area || '',
    role: demoUser.role || fallbackAccount.role || 'Demo User',
    email: demoUser.email || fallbackAccount.email,
    password: password || fallbackAccount.password,
    memberSince: createdAt.toLocaleDateString('en-PK', { month: 'short', year: 'numeric' }),
  };
}

async function tryDemoPublicUserLogin(email, password) {
  const client = getSupabaseClient();
  const accountApi = getAuthApi();
  if (!client || !accountApi) return null;

  const { data, error } = await client
    .from('demo_public_users')
    .select('*')
    .eq('email', email);

  if (error || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  let passwordHash = '';
  try {
    passwordHash = await hashPasswordSha256(password);
  } catch (error) {
    return null;
  }

  const match = data.find(row => {
    if (!row || row.is_active === false) return false;
    return String(row.demo_password_hash || '') === String(passwordHash || '');
  });

  if (!match) return null;

  const fallback = accountApi.readAccount();
  const demoAccount = toAccountFromDemoUser(match, password, fallback);
  accountApi.writeAccount(demoAccount);
  accountApi.setSession(demoAccount);
  accountApi.syncAccountChrome();
  localStorage.setItem('hisaabpro.remember.v1', 'true');
  return demoAccount;
}

function setAuthStatus(message, type = 'error') {
  const status = document.getElementById('authStatus');
  if (!status) return;
  status.style.display = 'block';
  status.className = `alert alert-${type === 'success' ? 'success' : 'danger'}`;
  status.textContent = message;
}

function clearAuthStatus() {
  const status = document.getElementById('authStatus');
  if (!status) return;
  status.style.display = 'none';
  status.textContent = '';
}

function redirectToDashboard() {
  window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
  const accountApi = getAuthApi();
  if (!accountApi) return;

  const storedAccount = accountApi.readAccount();

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const rememberInput = document.getElementById('rememberMe');

    if (emailInput && storedAccount.email) {
      emailInput.value = storedAccount.email;
    }

    loginForm.addEventListener('submit', async event => {
      event.preventDefault();
      clearAuthStatus();

      const email = sanitizeEmail(emailInput?.value || '');
      const password = passwordInput?.value || '';

      if (!email || !password) {
        setAuthStatus('Enter your email and password to continue.');
        return;
      }

      const demoAccount = await tryDemoPublicUserLogin(email, password);
      if (demoAccount) {
        if (rememberInput?.checked) {
          localStorage.setItem('hisaabpro.remember.v1', 'true');
        } else {
          localStorage.removeItem('hisaabpro.remember.v1');
        }
        setAuthStatus('Sign-in successful. Redirecting...', 'success');
        window.setTimeout(redirectToDashboard, 350);
        return;
      }

      const account = accountApi.readAccount();
      if (!account.email || !account.password || email !== account.email.toLowerCase() || password !== account.password) {
        setAuthStatus('Invalid email or password. Use a demo user or create a new demo account.');
        return;
      }

      accountApi.setSession(account);
      if (rememberInput?.checked) {
        localStorage.setItem('hisaabpro.remember.v1', 'true');
      } else {
        localStorage.removeItem('hisaabpro.remember.v1');
      }

      setAuthStatus('Sign-in successful. Redirecting...', 'success');
      window.setTimeout(redirectToDashboard, 350);
    });
  }

  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    const submitBtn = registerForm.querySelector('button[type="submit"], input[type="submit"]');
    let isSubmitting = false;

    registerForm.addEventListener('submit', async event => {
      event.preventDefault();
      clearAuthStatus();

      if (isSubmitting) {
        setAuthStatus('Account creation is already in progress. Please wait...');
        return;
      }

      const firstName = document.getElementById('firstName')?.value || '';
      const lastName = document.getElementById('lastName')?.value || '';
      const storeName = document.getElementById('storeName')?.value || '';
      const contactNumber = (document.getElementById('contactNumber')?.value || '').trim();
      const email = sanitizeEmail(document.getElementById('regEmail')?.value || '');
      const password = document.getElementById('regPassword')?.value || '';
      const confirmPassword = document.getElementById('confirmPassword')?.value || '';

      if (!firstName.trim() || !storeName.trim() || !contactNumber || !email || !password.trim()) {
        setAuthStatus('Fill in the required fields before creating your account.');
        return;
      }

      if (!isValidEmail(email)) {
        setAuthStatus('Please enter a valid email address (example: yourname@gmail.com).');
        return;
      }

      if (password.length < 8) {
        setAuthStatus('Password must be at least 8 characters long.');
        return;
      }

      if (password !== confirmPassword) {
        setAuthStatus('Passwords do not match.');
        return;
      }

      const client = getSupabaseClient();
      isSubmitting = true;
      if (submitBtn) submitBtn.disabled = true;

      try {
        if (client) {
          const existing = await client
            .from('demo_public_users')
            .select('email')
            .eq('email', email);

          if (existing.error) {
            setAuthStatus(existing.error.message || 'Could not validate existing accounts.');
            return;
          }

          if (Array.isArray(existing.data) && existing.data.length > 0) {
            setAuthStatus('This email is already registered. Try signing in instead.');
            return;
          }

          let passwordHash = '';
          try {
            passwordHash = await hashPasswordSha256(password);
          } catch (error) {
            setAuthStatus(error.message || 'Could not securely process password.');
            return;
          }

          const payload = {
            email,
            demo_password_hash: passwordHash,
            first_name: toTitleCase(firstName),
            last_name: toTitleCase(lastName),
            store_name: storeName.trim(),
            role: 'Owner',
            phone: contactNumber,
            is_active: true,
          };

          const insertResult = await client
            .from('demo_public_users')
            .insert(payload);

          if (insertResult.error) {
            setAuthStatus(insertResult.error.message || 'Could not create demo account.');
            return;
          }
        }

        const account = accountApi.writeAccount({
          firstName: toTitleCase(firstName),
          lastName: toTitleCase(lastName),
          storeName: storeName.trim(),
          phone: contactNumber,
          email,
          password,
          memberSince: new Date().toLocaleDateString('en-PK', { month: 'short', year: 'numeric' }),
          role: 'Owner',
        });

        accountApi.setSession(account);
        localStorage.setItem('hisaabpro.remember.v1', 'true');
        setAuthStatus('Demo account created. Redirecting to your dashboard...', 'success');
        window.setTimeout(redirectToDashboard, 450);
      } finally {
        isSubmitting = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
});