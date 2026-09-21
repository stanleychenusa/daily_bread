'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Mail, Wheat } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { readJson } from '@/lib/client';

export default function WelcomePage() {
  const [mode, setMode] = useState<'login' | 'create'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<{ email: string; sent: boolean; previewUrl?: string } | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('confirmed') === 'invalid') {
      setError('That confirmation link is no longer valid. Please create your account again.');
    }
  }, []);

  function changeMode(nextMode: 'login' | 'create') {
    setMode(nextMode);
    setError('');
    setConfirmation(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '');
    const password = String(data.get('password') ?? '');

    try {
      if (mode === 'create') {
        const confirmPassword = String(data.get('confirmPassword') ?? '');
        if (password !== confirmPassword) throw new Error('Those passwords don’t match yet.');
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: String(data.get('firstName') ?? ''),
            lastName: String(data.get('lastName') ?? ''),
            email,
            password,
          }),
        });
        const result = await readJson<{ emailSent: boolean; previewVerificationUrl?: string }>(response);
        setConfirmation({ email, sent: result.emailSent, previewUrl: result.previewVerificationUrl });
      } else {
        await readJson<{ ok: boolean }>(await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        }));
        window.location.href = '/home';
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="Daily Bread introduction">
        <a className="brand-lockup" href="/" aria-label="Daily Bread home">
          <span className="brand-mark"><Wheat aria-hidden="true" /></span>
          <span>
            <strong>Daily Bread</strong>
            <small>Your daily portion of Scripture.</small>
          </span>
        </a>

        <div className="story-copy">
          <p className="eyebrow">Read · Reflect · Grow</p>
          <h1>A little time in the Word goes a long way.</h1>
          <p>
            Keep a gentle rhythm, celebrate the verses you’ve read, and grow
            alongside people who cheer you on.
          </p>
        </div>

        <div className="daily-verse">
          <span>Today’s encouragement</span>
          <blockquote>“Give us this day our daily bread.”</blockquote>
          <cite>Matthew 6:11</cite>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="mobile-brand"><Wheat aria-hidden="true" /> Daily Bread</div>
          <p className="eyebrow">Welcome to the table</p>
          <h2>{mode === 'login' ? 'Good to see you again.' : 'Pull up a chair.'}</h2>
          <p className="auth-intro">
            {mode === 'login'
              ? 'Sign in to continue your reading journey.'
              : 'Create your account and begin a simple, steady reading habit.'}
          </p>

          <div className="auth-tabs" role="tablist" aria-label="Account options">
            <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => changeMode('login')}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === 'create'} onClick={() => changeMode('create')}>Create account</button>
          </div>

          {confirmation ? (
            <div className="confirmation-panel">
              <span className="confirmation-icon">{confirmation.sent ? <Mail /> : <CheckCircle2 />}</span>
              <h3>{confirmation.sent ? 'Check your inbox.' : 'Your account is ready to confirm.'}</h3>
              <p>
                {confirmation.sent
                  ? <>We sent a confirmation link to <strong>{confirmation.email}</strong>.</>
                  : <>Email delivery isn’t connected in this preview. Use the button below to preview the confirmation step for <strong>{confirmation.email}</strong>.</>}
              </p>
              {confirmation.previewUrl && (
                <Button render={<a href={confirmation.previewUrl} />} size="lg" className="primary-action">Preview confirmation <ArrowRight /></Button>
              )}
              <button type="button" className="text-button" onClick={() => changeMode('login')}>Back to sign in</button>
            </div>
          ) : <form className="auth-form" onSubmit={submit}>
            {mode === 'create' && (
              <div className="name-row">
                <label>First name<Input name="firstName" autoComplete="given-name" placeholder="Maya" required /></label>
                <label>Last name<Input name="lastName" autoComplete="family-name" placeholder="Carter" required /></label>
              </div>
            )}
            <label>Email address<Input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
            <label>
              Password
              <span className="password-field">
                <Input name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" required />
                <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </span>
            </label>
            {mode === 'create' && (
              <label>Confirm password<Input name="confirmPassword" type="password" autoComplete="new-password" placeholder="Type it once more" required /></label>
            )}

            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" size="lg" className="primary-action" disabled={busy}>
              {busy ? 'Just a moment…' : mode === 'login' ? 'Sign in' : 'Create my account'}
              <ArrowRight aria-hidden="true" />
            </Button>
          </form>}

          {!confirmation && <p className="auth-footnote">
            {mode === 'create' ? 'We’ll send a confirmation link to your email.' : 'New here? Choose “Create account” above to get started.'}
          </p>}
        </div>
      </section>
    </main>
  );
}
