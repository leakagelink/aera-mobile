const form = document.querySelector('#delete-form');
const result = document.querySelector('#result');

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
