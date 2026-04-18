// =========================================
// HisaabPro — Payment & Subscription (Demo Mode)
// =========================================

function getPaymentApi() {
  return window.HPAccount;
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

function setPaymentStatus(message, type = 'success') {
  const status = document.getElementById('paymentStatus');
  if (!status) return;
  status.style.display = 'block';
  status.className = `alert alert-${type === 'success' ? 'success' : 'danger'}`;
  status.textContent = message;
}

function planDisplay(plan) {
  const key = String(plan || '').toLowerCase();
  if (key === 'pro') return 'Pro';
  if (key === 'business') return 'Business';
  return 'Starter';
}

function renewalFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

document.addEventListener('DOMContentLoaded', async () => {
  const accountApi = getPaymentApi();
  const client = getSupabaseClient();
  if (!accountApi || !client) return;

  const account = accountApi.readAccount();
  const email = sanitizeEmail(account.email || '');
  if (!email) {
    setPaymentStatus('Please login first to manage subscription.', 'danger');
    return;
  }

  const loadSubscription = async () => {
    const { data, error } = await client
      .from('demo_public_users')
      .select('subscription_plan, subscription_status, subscription_renewal_date')
      .eq('email', email);

    if (error || !Array.isArray(data) || !data.length) {
      setPaymentStatus('Could not load subscription details.', 'danger');
      return;
    }

    const row = data[0];
    const plan = planDisplay(row.subscription_plan);
    const renewal = row.subscription_renewal_date || renewalFromNow(30);

    const planInput = document.getElementById('currentPlanName');
    const renewalInput = document.getElementById('renewalDate');
    const statusChip = document.getElementById('subscriptionStatusChip');

    if (planInput) planInput.value = plan;
    if (renewalInput) renewalInput.value = renewal;
    if (statusChip) {
      statusChip.textContent = String(row.subscription_status || 'active').toUpperCase();
      statusChip.className = `chip ${String(row.subscription_status || '').toLowerCase() === 'active' ? 'chip-lime' : 'chip-amber'}`;
    }
  };

  const updatePlan = async plan => {
    const normalized = String(plan || 'starter').toLowerCase();
    const renewalDays = normalized === 'business' ? 60 : 30;

    const { error } = await client
      .from('demo_public_users')
      .eq('email', email)
      .update({
        subscription_plan: normalized,
        subscription_status: 'active',
        subscription_renewal_date: renewalFromNow(renewalDays),
      });

    if (error) {
      setPaymentStatus(error.message || 'Could not update subscription.', 'danger');
      return;
    }

    setPaymentStatus(`Subscription updated to ${planDisplay(normalized)} plan.`, 'success');
    await loadSubscription();
  };

  document.querySelectorAll('button[data-plan]').forEach(button => {
    button.addEventListener('click', async () => {
      const plan = button.dataset.plan;
      await updatePlan(plan);
    });
  });

  await loadSubscription();
});