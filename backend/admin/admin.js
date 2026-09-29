const loginView = document.querySelector('#login');
const appView = document.querySelector('#app');
const main = document.querySelector('#main');
const loginError = document.querySelector('#login-error');

document.querySelector('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  const form = new FormData(event.currentTarget);
  const response = await fetch('/api/v1/admin/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    loginError.textContent = body.message || 'Sign-in failed.';
    return;
  }
  event.currentTarget.reset();
  showApp();
  await render('dashboard');
});

document.querySelector('#logout').addEventListener('click', async () => {
  await fetch('/api/v1/admin/auth/logout', { method: 'POST', credentials: 'include' });
  appView.classList.add('hidden');
  loginView.classList.remove('hidden');
});

document.querySelectorAll('nav button').forEach((button) => {
  button.addEventListener('click', async () => {
    document.querySelectorAll('nav button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    await render(button.dataset.view);
  });
});

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    ...options,
  });
  if (response.status === 401) {
    appView.classList.add('hidden');
    loginView.classList.remove('hidden');
    throw new Error('Sign in required.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'Request failed.');
  return body;
}

function showApp() {
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
}

function text(value) {
  return value == null || value === '' ? '—' : String(value);
}

async function render(view, selectedProvider) {
  main.replaceChildren();
  if (view === 'dashboard') return renderDashboard();
  if (view === 'providers') return renderProviders(selectedProvider);
  if (view === 'health') return renderHealth();
  if (view === 'audit') return renderAudit();
  if (view === 'google') return renderGoogle();
  return renderSettings();
}

async function renderDashboard() {
  const [health, providers] = await Promise.all([api('/api/v1/admin/system/health'), api('/api/v1/admin/providers')]);
  const section = document.createElement('section');
  section.innerHTML = '<h1>Dashboard</h1><h2>System status</h2>';
  const system = document.createElement('div');
  system.className = 'grid';
  for (const [label, value] of [['Backend', health.backend], ['Database', health.database], ['Redis', health.redis]]) {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `<p class="muted">${label}</p><strong>${text(value)}</strong>`;
    system.append(card);
  }
  section.append(system);
  const heading = document.createElement('h2');
  heading.textContent = 'Provider status';
  section.append(heading);
  const grid = document.createElement('div');
  grid.className = 'grid';
  const catalog = await api('/api/v1/admin/providers/catalog');
  for (const entry of catalog) {
    const saved = providers.find((item) => item.provider === entry.provider);
    const card = document.createElement('article');
    card.className = 'card';
    const status = saved?.status || 'NOT CONFIGURED';
    const keyLine = saved?.apiKeyConfigured ? `Key stored ••••••••${saved.apiKeyLast4 || ''}` : 'No key stored';
    card.innerHTML = `<p>${entry.name}</p><strong class="${status}">${status}</strong><p class="status">${saved?.enabled ? 'Enabled on' : 'Enabled off'}<br>${keyLine}<br>Default ${saved?.isDefault ? 'on' : 'off'}<br>Last checked ${text(saved?.lastTestedAt)}<br>Latency ${text(saved?.lastTestLatencyMs)} ms<br>Last success ${text(saved?.lastSuccessAt)}<br>${text(saved?.lastTestMessage)}</p>`;
    grid.append(card);
  }
  section.append(grid);
  const run = document.createElement('button');
  run.type = 'button';
  run.textContent = 'Run All Health Checks';
  run.addEventListener('click', async () => {
    run.disabled = true;
    await api('/api/v1/admin/providers/health-check', { method: 'POST' });
    await render('dashboard');
  });
  section.append(run);
  main.append(section);
}

async function renderProviders(selectedProvider = 'openweather') {
  const [catalog, providers] = await Promise.all([api('/api/v1/admin/providers/catalog'), api('/api/v1/admin/providers')]);
  const section = document.createElement('section');
  section.innerHTML = '<h1>Providers</h1>';
  const split = document.createElement('div');
  split.className = 'split';
  const list = document.createElement('div');
  list.className = 'provider-list';
  const formHost = document.createElement('div');
  const show = (provider) => {
    const entry = catalog.find((item) => item.provider === provider) || catalog[0];
    formHost.replaceChildren(providerForm(entry, providers.find((item) => item.provider === entry.provider)));
    for (const button of list.querySelectorAll('button')) button.classList.toggle('active', button.dataset.provider === entry.provider);
  };
  for (const entry of catalog) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost';
    button.dataset.provider = entry.provider;
    button.textContent = `${entry.name}`;
    button.addEventListener('click', () => show(entry.provider));
    list.append(button);
  }
  split.append(list, formHost);
  section.append(split);
  main.append(section);
  show(selectedProvider);
}

function providerForm(entry, saved) {
  const form = document.createElement('form');
  form.className = 'card';
  form.innerHTML = `
    <h2>${entry.name}</h2>
    <p class="muted">${entry.providerType}</p>
    <label>Enabled <select name="enabled"><option value="true">ON</option><option value="false">OFF</option></select></label>
    <label>Default <select name="isDefault"><option value="false">OFF</option><option value="true">ON</option></select></label>
    <label>Base URL <input name="baseUrl" required /></label>
    <label>API key <input name="apiKey" type="password" autocomplete="off" placeholder="Leave empty to keep the current key" /></label>
    <p class="status">${entry.provider === 'relay' ? 'Paste the Relay Models key from relaymodels.com. Arah calls this API only when Gemini cannot answer. Leave Default off so Gemini stays first.' : 'Paste only the ' + entry.name + ' key. OpenWeather, TomTom, Gemini, and Relay Models each keep a different key.'}</p>
    <p class="status" data-key></p>
    <label>Model <input name="model" /></label>
    <label>Timeout (ms) <input name="timeoutMs" type="number" min="1000" max="30000" required /></label>
    <div class="row"><button type="submit">Save Changes</button><button type="button" data-test>Test Connection</button></div>
    <p class="status" data-message></p>
  `;
  form.elements.baseUrl.value = saved?.baseUrl || entry.defaultBaseUrl;
  form.elements.timeoutMs.value = saved?.timeoutMs || 10000;
  form.elements.model.value = saved?.model || (entry.provider === 'relay' ? 'gpt-5-mini' : '');
  form.elements.model.placeholder = entry.provider === 'relay' ? 'gpt-5-mini' : '';
  form.elements.enabled.value = String(Boolean(saved?.enabled));
  form.elements.isDefault.value = String(Boolean(saved?.isDefault));
  form.querySelector('[data-key]').textContent = saved?.apiKeyConfigured ? `Current key ••••••••${saved.apiKeyLast4 || ''}` : 'No API key stored.';
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = form.querySelector('[data-message]');
    message.textContent = '';
    const payload = {
      provider: entry.provider,
      providerType: entry.providerType,
      name: entry.name,
      baseUrl: form.elements.baseUrl.value,
      enabled: form.elements.enabled.value === 'true',
      isDefault: form.elements.isDefault.value === 'true',
      timeoutMs: Number(form.elements.timeoutMs.value),
      model: form.elements.model.value,
    };
    if (form.elements.apiKey.value.trim()) payload.apiKey = form.elements.apiKey.value.trim();
    try {
      if (saved?.id) await api(`/api/v1/admin/providers/${saved.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await api('/api/v1/admin/providers', { method: 'POST', body: JSON.stringify(payload) });
      form.elements.apiKey.value = '';
      await render('providers', entry.provider);
      const note = main.querySelector('[data-message]');
      if (note) note.textContent = 'Saved.';
    } catch (error) {
      message.textContent = error.message;
    }
  });
  form.querySelector('[data-test]').addEventListener('click', async () => {
    const message = form.querySelector('[data-message]');
    if (!saved?.id) {
      message.textContent = 'Save the provider before testing it.';
      return;
    }
    try {
      const result = await api(`/api/v1/admin/providers/${saved.id}/test`, { method: 'POST' });
      await render('providers', entry.provider);
      const note = main.querySelector('[data-message]');
      if (note) note.textContent = `${result.message} (${result.latencyMs} ms)`;
    } catch (error) {
      message.textContent = error.message;
    }
  });
  return form;
}

async function renderHealth() {
  const health = await api('/api/v1/admin/system/health');
  const section = document.createElement('section');
  section.className = 'card';
  section.innerHTML = `<h1>System Health</h1><p>Backend ${text(health.backend)}</p><p>Database ${text(health.database)}</p><p>Redis ${text(health.redis)}</p>`;
  main.append(section);
}

async function renderAudit() {
  const rows = await api('/api/v1/admin/audit-logs');
  const section = document.createElement('section');
  section.innerHTML = '<h1>Audit Logs</h1>';
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Time</th><th>Action</th><th>Provider</th><th>Result</th><th>IP</th></tr></thead>';
  const body = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const value of [row.createdAt, row.action, row.provider, row.success ? 'success' : 'failure', row.ipAddress]) {
      const cell = document.createElement('td');
      cell.textContent = text(value);
      tr.append(cell);
    }
    body.append(tr);
  }
  table.append(body);
  section.append(table);
  main.append(section);
}

async function renderGoogle() {
  const current = await api('/api/v1/admin/google');
  const section = document.createElement('section');
  section.className = 'card';
  const title = document.createElement('h1');
  title.textContent = 'Google sign-in and notifications';
  const copy = document.createElement('p');
  copy.className = 'status';
  copy.textContent = 'Save the web client ID, the Android client ID, and the Firebase service account JSON. The JSON is encrypted on the server and is not shown again. Do not paste it into chat or GitHub.';
  const form = document.createElement('form');
  form.append(field('Web client ID', 'web', current.webClientId || '', '123456-abc.apps.googleusercontent.com'));
  form.append(field('Android client ID', 'android', current.androidClientId || '', '123456-abc.apps.googleusercontent.com'));
  const fileLabel = document.createElement('label');
  fileLabel.textContent = 'Firebase service account JSON';
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'application/json,.json';
  fileLabel.append(file);
  form.append(fileLabel);
  const status = document.createElement('p');
  status.className = 'status';
  status.textContent = current.serviceAccountConfigured
    ? `Service account saved for ${current.projectId || 'a project'} as ${current.clientEmail || 'a service account'}.`
    : 'No service account uploaded.';
  const result = document.createElement('p');
  result.className = 'status';
  result.setAttribute('role', 'status');
  const row = document.createElement('div');
  row.className = 'row';
  const save = document.createElement('button');
  save.type = 'submit';
  save.textContent = 'Save';
  const test = document.createElement('button');
  test.type = 'button';
  test.className = 'ghost';
  test.textContent = 'Test service account';
  test.disabled = !current.serviceAccountConfigured;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'ghost';
  remove.textContent = 'Remove service account';
  remove.disabled = !current.serviceAccountConfigured;
  row.append(save, test, remove);
  form.append(status, row, result);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    result.textContent = 'Saving…';
    const payload = { webClientId: form.querySelector('[name="web"]').value, androidClientId: form.querySelector('[name="android"]').value };
    if (file.files?.[0]) payload.serviceAccountJson = await file.files[0].text();
    try {
      await api('/api/v1/admin/google', { method: 'PATCH', body: JSON.stringify(payload) });
      file.value = '';
      await render('google');
    } catch (error) {
      result.textContent = error instanceof Error ? error.message : 'Save failed.';
    }
  });
  test.addEventListener('click', async () => {
    result.textContent = 'Testing…';
    try {
      const report = await api('/api/v1/admin/google/test', { method: 'POST' });
      result.textContent = report.message;
    } catch (error) {
      result.textContent = error instanceof Error ? error.message : 'Test failed.';
    }
  });
  remove.addEventListener('click', async () => {
    result.textContent = 'Removing…';
    try {
      await api('/api/v1/admin/google', { method: 'PATCH', body: JSON.stringify({ clearServiceAccount: true }) });
      await render('google');
    } catch (error) {
      result.textContent = error instanceof Error ? error.message : 'Remove failed.';
    }
  });
  section.append(title, copy, form);
  main.append(section);
}

function field(label, name, value, placeholder) {
  const wrap = document.createElement('label');
  wrap.append(document.createTextNode(label));
  const input = document.createElement('input');
  input.name = name;
  input.value = value;
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  wrap.append(input);
  return wrap;
}

async function renderSettings() {
  const [settings, me] = await Promise.all([api('/api/v1/admin/settings'), api('/api/v1/admin/auth/me')]);
  const section = document.createElement('section');
  section.className = 'card';
  section.innerHTML = `<h1>Settings</h1>
    <p>Encryption key configured: ${settings.encryptionKeyConfigured ? 'yes' : 'no'}</p>
    <p>Admin authentication configured: ${settings.adminAuthConfigured ? 'yes' : 'no'}</p>
    <p>OpenWeather environment fallback: ${settings.openWeatherEnvConfigured ? 'set' : 'not set'}</p>
    <p>Gemini environment fallback: ${settings.geminiEnvConfigured ? 'set' : 'not set'}</p>
    <p>TomTom environment fallback: ${settings.tomtomEnvConfigured ? 'set' : 'not set'}</p>
    <p>Weather cache TTL: ${settings.weatherCacheTtlSeconds} seconds</p>`;
  main.append(section);

  const account = document.createElement('section');
  account.className = 'card';
  account.style.marginTop = '16px';
  const heading = document.createElement('h2');
  heading.textContent = 'Admin login';
  const copy = document.createElement('p');
  copy.className = 'status';
  copy.textContent = 'This changes the admin panel login only. Phone app accounts stay separate.';
  const form = document.createElement('form');
  const email = document.createElement('input');
  email.name = 'email';
  email.type = 'email';
  email.required = true;
  email.value = me.email || '';
  email.autocomplete = 'username';
  form.append(labeled('Login email', email));
  const nextPassword = document.createElement('input');
  nextPassword.name = 'newPassword';
  nextPassword.type = 'password';
  nextPassword.minLength = 8;
  nextPassword.autocomplete = 'new-password';
  nextPassword.placeholder = 'Leave blank to keep the current password';
  form.append(labeled('New password', nextPassword));
  const currentPassword = document.createElement('input');
  currentPassword.name = 'currentPassword';
  currentPassword.type = 'password';
  currentPassword.required = true;
  currentPassword.minLength = 8;
  currentPassword.autocomplete = 'current-password';
  form.append(labeled('Current password', currentPassword));
  const result = document.createElement('p');
  result.className = 'status';
  result.setAttribute('role', 'status');
  const save = document.createElement('button');
  save.type = 'submit';
  save.textContent = 'Save login';
  form.append(save, result);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    result.textContent = 'Saving…';
    try {
      const payload = { email: email.value, currentPassword: currentPassword.value };
      if (nextPassword.value) payload.newPassword = nextPassword.value;
      await api('/api/v1/admin/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      currentPassword.value = '';
      nextPassword.value = '';
      result.textContent = 'Admin login updated.';
    } catch (error) {
      result.textContent = error instanceof Error ? error.message : 'The login was not updated.';
    }
  });
  account.append(heading, copy, form);
  main.append(account);
}

function labeled(label, input) {
  const wrap = document.createElement('label');
  wrap.append(document.createTextNode(label), input);
  return wrap;
}

api('/api/v1/admin/auth/me').then(() => {
  showApp();
  return render('dashboard');
}).catch(() => {});
