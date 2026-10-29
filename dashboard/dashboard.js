(() => {
  'use strict';
  const base = window.SURVEY_CONFIG.supabaseUrl.replace(/\/$/, '');
  const key = window.SURVEY_CONFIG.supabaseKey;
  const el = id => document.getElementById(id);
  let refreshing = false;
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
    if (!response.ok) throw new Error('Request failed');
    return response.json();
  }
  async function refresh() {
    if (refreshing) return;
    refreshing = true; el('refresh').disabled = true;
    try {
      const data = await request('/rest/v1/rpc/ai_survey_dashboard', { method: 'POST', headers: {apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json'}, body: '{}' });
      if (!Number.isInteger(data.completed) || !Number.isInteger(data.partial)) throw new Error('Unexpected results format');
      el('toolbar').hidden = false; el('content').hidden = false; el('error').hidden = true;
      el('completed').textContent = data.completed; el('partial').textContent = data.partial; el('tasks').textContent = data.task_examples;
      el('task-summary').textContent = summarizeTasks(data.task_themes, data.task_examples);
      bars('task_themes', data.task_themes, data.task_examples, 'task examples');
      for (const id of ['frequency','tools','barriers','follow_up']) bars(id, data[id], data.completed);
      el('updated').textContent = 'Updated ' + new Date(data.generated_at).toLocaleString(undefined, {dateStyle:'medium',timeStyle:'short'});
    } catch (error) {
      el('error').hidden = false;
      el('error').textContent = 'Could not refresh the results. Please try again.';
    } finally { refreshing = false; el('refresh').disabled = false; }
  }
  el('refresh').addEventListener('click', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  refresh();
})();
