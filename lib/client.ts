export type User = { id: string; firstName: string; lastName: string; email: string };

export async function fetchCurrentUser() {
  const response = await fetch('/api/me', { cache: 'no-store' });
  if (response.status === 401) {
    window.location.href = '/';
    throw new Error('Not signed in');
  }
  if (!response.ok) throw new Error('Could not load your account.');
  return (await response.json() as { user: User }).user;
}

export async function readJson<T>(response: Response): Promise<T> {
  const responseText = await response.text();
  let body: (T & { error?: string }) | null = null;

  if (responseText) {
    try {
      body = JSON.parse(responseText) as T & { error?: string };
    } catch {
      // Keep the response handling resilient when an upstream error page is returned.
    }
  }

  if (!response.ok) throw new Error(body?.error ?? 'The server had trouble with that request. Please try again.');
  if (!body) throw new Error('The server returned an incomplete response. Please try again.');
  return body;
}
