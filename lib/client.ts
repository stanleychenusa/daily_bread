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
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Something went wrong.');
  return body;
}
