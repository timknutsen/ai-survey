(() => {
  'use strict';
  const config = window.SURVEY_CONFIG;
  const base = config.supabaseUrl.replace(/\/$/, '');
  const key = config.supabaseKey;
  const legacyStorage = 'ai-survey-dashboard-session';
  const rememberUntilKey = 'ai-survey-dashboard-remember-until';
  const rememberDuration = 30 * 24 * 60 * 60 * 1000;
  const el = id => document.getElementById(id);
  const headers = token => ({ apikey: key, 'Content-Type': 'application/json', ...(token ? {Authorization: 'Bearer ' + token} : {}) });
  const auth = window.supabase.createClient(base, key, {auth: {
    storageKey: 'ai-survey-dashboard-auth', persistSession: true,
    autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit',
  }}).auth;
  let legacyToken = sessionStorage.getItem(legacyStorage) || '';
  let hasSession = false;
  let refreshing = false;
  let loginNotice = '';

  // A successful link can start a new 30-day remembered period on this browser.
  const fragment = new URLSearchParams(location.hash.slice(1));
  const isNewLink = fragment.has('access_token') && fragment.has('refresh_token');
  if (isNewLink) {
    try { localStorage.setItem(rememberUntilKey, String(Date.now() + rememberDuration)); } catch { /* Private browsing may not persist. */ }
    sessionStorage.removeItem(legacyStorage); legacyToken = '';
  }

  function showLogin(message = '') {
    hasSession = false;
    el('content').hidden = true; el('toolbar').hidden = true; el('login').hidden = false;
    el('error').hidden = true; el('login-message').textContent = message;
  }
  function rememberDeadline() {
    try { return Number(localStorage.getItem(rememberUntilKey)) || 0; } catch { return 0; }
  }
  function clearRememberDeadline() {
    try { localStorage.removeItem(rememberUntilKey); } catch { /* Storage may be unavailable. */ }
  }
  async function currentToken() {
    const {data, error} = await auth.getSession();
    if (error) throw error;
    if (data.session) {
      let deadline = rememberDeadline();
      if (!deadline) {
        deadline = Date.now() + rememberDuration;
        try { localStorage.setItem(rememberUntilKey, String(deadline)); } catch { /* Session remains available for this visit. */ }
      }
      if (Date.now() >= deadline) {
        const result = await auth.signOut({scope:'local'});
        if (result.error) throw result.error;
        clearRememberDeadline();
        const expired = new Error('Remembered session expired'); expired.status = 401; throw expired;
      }
      return data.session.access_token;
    }
    return legacyToken;
  }
  function bars(id, rows, total, population = 'completed responses') {
    const target = el(id); target.replaceChildren();
    if (!Array.isArray(rows) || rows.length === 0) {
      const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No answers yet.'; target.append(empty); return;
    }
    for (const row of rows) {
      const wrap = document.createElement('div');
      const head = document.createElement('div'); head.className = 'bar-head';
      const label = document.createElement('span'); label.className = 'bar-label'; label.textContent = row.label;
      const value = document.createElement('span'); value.className = 'bar-value'; value.textContent = String(row.n);
      const bar = document.createElement('progress'); bar.className = 'bar-track'; bar.max = Math.max(total, 1); bar.value = row.n;
      bar.setAttribute('aria-label', row.label + ': ' + row.n + ' of ' + total + ' ' + population);
      head.append(label, value); wrap.append(head, bar); target.append(wrap);
    }
  }
  function summarizeTasks(rows, total) {
    if (!total) return 'No task examples have been shared yet.';
    const topics = (Array.isArray(rows) ? rows : [])
      .filter(row => row.label !== 'Not classified' && row.n > 0)
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).slice(0, 3);
    if (!topics.length) return 'No examples matched the current keyword groups.';
    const list = topics.map(row => `${row.label.toLowerCase()} (${row.n})`);
    return 'Most frequently identified: ' + new Intl.ListFormat('en', {style:'long',type:'conjunction'}).format(list) + '.';
  }
  async function request(path, options = {}) {
    const response = await fetch(base + path, {cache: 'no-store', ...options});
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { const err = new Error(body.msg || body.message || 'Request failed'); err.status = response.status; throw err; }
    return body;
  }
  async function refresh() {
    if (refreshing) return;
    refreshing = true; el('refresh').disabled = true;
    try {
      const token = await currentToken();
      if (!token) { showLogin(loginNotice); return; }
      const data = await request('/rest/v1/rpc/ai_survey_dashboard', { method: 'POST', headers: headers(token), body: '{}' });
      if (!Number.isInteger(data.completed) || !Number.isInteger(data.partial)) throw new Error('Unexpected results format');
      hasSession = true; loginNotice = '';
      el('login').hidden = true; el('toolbar').hidden = false; el('content').hidden = false; el('error').hidden = true;
      el('completed').textContent = data.completed; el('partial').textContent = data.partial; el('tasks').textContent = data.task_examples;
      el('task-summary').textContent = summarizeTasks(data.task_themes, data.task_examples);
      bars('task_themes', data.task_themes, data.task_examples, 'task examples');
      for (const id of ['frequency','tools','barriers','follow_up']) bars(id, data[id], data.completed);
      el('updated').textContent = 'Updated ' + new Date(data.generated_at).toLocaleString(undefined, {dateStyle:'medium',timeStyle:'short'});
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        legacyToken = ''; sessionStorage.removeItem(legacyStorage);
        await auth.signOut({scope:'local'}); clearRememberDeadline();
        showLogin('Your session has expired or this account cannot access the dashboard.');
      } else {
        if (el('content').hidden) el('login').hidden = false;
        el('error').hidden = false; el('error').textContent = 'Could not refresh the results. Please try again.';
      }
    } finally { refreshing = false; el('refresh').disabled = false; }
  }
  el('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const email = el('email').value.trim();
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    el('login-message').textContent = 'Sending…';
    try {
      const {error} = await auth.signInWithOtp({email, options:{
        emailRedirectTo: location.origin + location.pathname, shouldCreateUser: false,
      }});
      if (error) throw error;
      el('login-message').textContent = 'Check your email for the sign-in link. Open it in this browser.';
    } catch (error) {
      if (error.code === 'over_email_send_rate_limit' || /email rate limit/i.test(error.message || '')) {
        el('login-message').textContent = 'The email sending limit has been reached. Wait about an hour before requesting another link.';
      } else if (error.status === 429) {
        el('login-message').textContent = 'Too many sign-in requests. Please wait before trying again.';
      } else {
        el('login-message').textContent = 'Could not send a sign-in link. Check the email address and try again.';
      }
    } finally { button.disabled = false; }
  });
  el('refresh').addEventListener('click', refresh);
  el('signout').addEventListener('click', async () => {
    const button = el('signout'); button.disabled = true;
    if (legacyToken) {
      try {
        await request('/auth/v1/logout?scope=local', {method:'POST', headers:headers(legacyToken)});
      } catch (error) {
        if (error.status !== 401 && error.status !== 403) {
          button.disabled = false;
          el('error').hidden = false; el('error').textContent = 'Could not sign out. Check your connection and try again.';
          return;
        }
      }
    }
    const {error} = await auth.signOut({scope:'local'});
    button.disabled = false;
    if (error) { el('error').hidden = false; el('error').textContent = 'Could not sign out. Check your connection and try again.'; return; }
    legacyToken = ''; sessionStorage.removeItem(legacyStorage); clearRememberDeadline();
    loginNotice = 'Signed out.'; showLogin(loginNotice);
  });
  auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      legacyToken = ''; sessionStorage.removeItem(legacyStorage); clearRememberDeadline();
      showLogin(loginNotice);
    } else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
      setTimeout(refresh, 0);
    }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && hasSession) refresh(); });
  setInterval(() => { if (!document.hidden && hasSession) refresh(); }, 30000);
  refresh();
})();
