(() => {
  'use strict';
  const config = window.SURVEY_CONFIG;
  const base = config.supabaseUrl.replace(/\/$/, '');
  const key = config.supabaseKey;
  const storage = 'ai-survey-dashboard-session';
  const el = id => document.getElementById(id);
  const headers = token => ({ apikey: key, 'Content-Type': 'application/json', ...(token ? {Authorization: 'Bearer ' + token} : {}) });
  let token = '';
  let refreshing = false;

  // Supabase returns the verified session in the URL fragment. Remove it before rendering.
  const fragment = new URLSearchParams(location.hash.slice(1));
  const incoming = fragment.get('access_token');
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  if (incoming) { sessionStorage.setItem(storage, incoming); token = incoming; }
  else token = sessionStorage.getItem(storage) || '';

  function showLogin(message = '') {
    token = ''; sessionStorage.removeItem(storage);
    el('content').hidden = true; el('toolbar').hidden = true; el('login').hidden = false;
    el('error').hidden = true; el('login-message').textContent = message;
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
    if (!token || refreshing) return;
    refreshing = true; el('refresh').disabled = true;
    try {
      const data = await request('/rest/v1/rpc/ai_survey_dashboard', { method: 'POST', headers: headers(token), body: '{}' });
      if (!Number.isInteger(data.completed) || !Number.isInteger(data.partial)) throw new Error('Unexpected results format');
      el('login').hidden = true; el('toolbar').hidden = false; el('content').hidden = false; el('error').hidden = true;
      el('completed').textContent = data.completed; el('partial').textContent = data.partial; el('tasks').textContent = data.task_examples;
      el('task-summary').textContent = summarizeTasks(data.task_themes, data.task_examples);
      bars('task_themes', data.task_themes, data.task_examples, 'task examples');
      for (const id of ['frequency','tools','barriers','follow_up']) bars(id, data[id], data.completed);
      el('updated').textContent = 'Updated ' + new Date(data.generated_at).toLocaleString(undefined, {dateStyle:'medium',timeStyle:'short'});
    } catch (error) {
      if (error.status === 401 || error.status === 403) showLogin('Your session has expired or this account cannot access the dashboard.');
      else { el('error').hidden = false; el('error').textContent = 'Could not refresh the results. Please try again.'; }
    } finally { refreshing = false; el('refresh').disabled = false; }
  }
  el('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const email = el('email').value.trim();
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    el('login-message').textContent = 'Sending…';
    try {
      await request('/auth/v1/otp?redirect_to=' + encodeURIComponent(location.origin + location.pathname), {
        method: 'POST', headers: headers(), body: JSON.stringify({email, create_user: true})
      });
      el('login-message').textContent = 'Check your email for the sign-in link. Open it in this browser.';
    } catch (error) { el('login-message').textContent = 'Could not send a sign-in link. Please try again.'; }
    finally { button.disabled = false; }
  });
  el('refresh').addEventListener('click', refresh);
  el('signout').addEventListener('click', () => {
    const previous = token; showLogin('Signed out.');
    fetch(base + '/auth/v1/logout', {method:'POST', headers:headers(previous)}).catch(() => {});
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && token) refresh(); });
  setInterval(() => { if (!document.hidden && token) refresh(); }, 30000);
  if (token) refresh(); else showLogin();
})();
