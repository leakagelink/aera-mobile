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

async function render(view) {
  main.replaceChildren();
  if (view === 'dashboard') return renderDashboard();
  if (view === 'providers') return renderProviders();
  if (view === 'health') return renderHealth();
  if (view === 'audit') return renderAudit();
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
    card.innerHTML = `<p>${entry.name}</p><strong class="${status}">${status}</strong><p class="status">Last checked ${text(saved?.lastTestedAt)}<br>Latency ${text(saved?.lastTestLatencyMs)} ms<br>Last success ${text(saved?.lastSuccessAt)}<br>${text(saved?.lastTestMessage)}</p>`;
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

async function renderProviders() {
  const [catalog, providers] = await Promise.all([api('/api/v1/admin/providers/catalog'), api('/api/v1/admin/providers')]);
  const section = document.createElement('section');
  section.innerHTML = '<h1>Providers</h1>';
  const split = document.createElement('div');
  split.className = 'split';
  const list = document.createElement('div');
  list.className = 'provider-list';
  const formHost = document.createElement('div');
  for (const entry of catalog) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost';
    button.textContent = `${entry.name}`;
    button.addEventListener('click', () => formHost.replaceChildren(providerForm(entry, providers.find((item) => item.provider === entry.provider))));
    list.append(button);
  }
  split.append(list, formHost);
  section.append(split);
  formHost.append(providerForm(catalog.find((entry) => entry.provider === 'openweather'), providers.find((item) => item.provider === 'openweather')));
  main.append(section);
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
    <label>API key <input name="apiKey" type="password" autocomplete="new-password" placeholder="Leave empty to keep the current key" /></label>
    <p class="status" data-key></p>
    <label>Model <input name="model" /></label>
    <label>Timeout (ms) <input name="timeoutMs" type="number" min="1000" max="30000" required /></label>
    <div class="row"><button type="submit">Save Changes</button><button type="button" data-test>Test Connection</button></div>
    <p class="status" data-message></p>
  `;
  form.elements.baseUrl.value = saved?.baseUrl || entry.defaultBaseUrl;
  form.elements.timeoutMs.value = saved?.timeoutMs || 10000;
  form.elements.model.value = saved?.model || '';
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
      message.textContent = 'Saved.';
      await render('providers');
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
      message.textContent = `${result.message} (${result.latencyMs} ms)`;
      await render('providers');
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

async function renderSettings() {
  const settings = await api('/api/v1/admin/settings');
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
}

api('/api/v1/admin/auth/me').then(() => {
  showApp();
  return render('dashboard');
}).catch(() => {});
