const form = document.querySelector('#delete-form');
const result = document.querySelector('#result');
const googleResult = document.querySelector('#google-result');
const googleButton = document.querySelector('#google-button');

void setupGoogleDeletion();

async function setupGoogleDeletion() {
  if (!(googleButton instanceof HTMLElement) || !(googleResult instanceof HTMLElement)) return;
  try {
    const response = await fetch('/api/v1/auth/google/client', { headers: { Accept: 'application/json' } });
    const body = await response.json().catch(() => null);
    const clientId = body && typeof body.clientId === 'string' ? body.clientId : '';
    if (!response.ok || !clientId) {
      googleResult.textContent = 'Google deletion is not connected yet. Delete a password account below, or delete from the Arah app while you are signed in.';
      return;
    }
    await loadGoogleScript();
    const google = window.google;
    if (!google?.accounts?.id) {
      googleResult.textContent = 'Google could not be loaded. Try again, or delete from the Arah app while you are signed in.';
      return;
    }
    google.accounts.id.initialize({
      client_id: clientId,
      callback: (credential) => {
        const idToken = credential && typeof credential.credential === 'string' ? credential.credential : '';
        void deleteWithGoogle(idToken);
      },
    });
    google.accounts.id.renderButton(googleButton, { theme: 'outline', size: 'large', text: 'continue_with', width: 320 });
  } catch {
    googleResult.textContent = 'Google could not be loaded. Try again, or delete from the Arah app while you are signed in.';
  }
}

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-identity]');
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.dataset.googleIdentity = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('google-script'));
    document.head.appendChild(script);
  });
}

async function deleteWithGoogle(idToken) {
  if (!(googleResult instanceof HTMLElement)) return;
  if (!idToken) {
    googleResult.textContent = 'Google did not confirm the account.';
    return;
  }
  googleResult.textContent = 'Deleting the Google account…';
  try {
    const response = await fetch('/api/v1/auth/google/delete-account', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (response.ok) {
      googleResult.textContent = 'The Arah account for that Google user has been deleted.';
      return;
    }
    const body = await response.json().catch(() => null);
    const message = body && typeof body.message === 'string' ? body.message : 'The Google account was not deleted.';
    googleResult.textContent = message;
  } catch {
    googleResult.textContent = 'The Google account was not deleted. Try again when you are online.';
  }
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!(form instanceof HTMLFormElement) || !(result instanceof HTMLElement)) return;
  const data = new FormData(form);
  const email = String(data.get('email') ?? '');
  const password = String(data.get('password') ?? '');
  result.textContent = 'Deleting the account…';
  try {
    const response = await fetch('/api/v1/auth/delete-account', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (response.ok) {
      form.reset();
      result.textContent = 'The Arah account has been deleted.';
      return;
    }
    const body = await response.json().catch(() => null);
    const message = body && typeof body.message === 'string' ? body.message : 'The account was not deleted. Check the email and password.';
    result.textContent = Array.isArray(message) ? message.join(' ') : message;
  } catch {
    result.textContent = 'The account was not deleted. Try again when you are online.';
  }
});
