'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Mail } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
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
      <section className="auth-panel">
        <div className="auth-card">
          <a className="auth-brand" href="/" aria-label="Daily Bread home"><span aria-hidden="true">🍞</span><strong>Daily Bread</strong></a>
          <p className="auth-tagline">Your daily portion of Scripture</p>
          {mode === 'create' && !confirmation && <h2>Create Your Account</h2>}

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
                <a href={confirmation.previewUrl} className={buttonVariants({ size: 'lg', className: 'primary-action' })}>Preview confirmation <ArrowRight /></a>
              )}
              <button type="button" className="text-button" onClick={() => changeMode('login')}>Back to sign in</button>
            </div>
          ) : <form className="auth-form" onSubmit={submit}>
            {mode === 'create' && (
              <div className="name-row">
                <label><span className="field-label">First name</span><Input name="firstName" autoComplete="given-name" placeholder="First name" required /></label>
                <label><span className="field-label">Last name</span><Input name="lastName" autoComplete="family-name" placeholder="Last name" required /></label>
              </div>
            )}
            <label><span className="field-label">Email address</span><Input name="email" type="email" autoComplete="email" placeholder="Email address" required /></label>
            <label>
              <span className="field-label">Password</span>
              <span className="password-field">
                <Input name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" required />
                <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </span>
            </label>
            {mode === 'create' && (
              <label><span className="field-label">Confirm password</span><Input name="confirmPassword" type="password" autoComplete="new-password" placeholder="Confirm password" required /></label>
            )}

            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" size="lg" className="primary-action" disabled={busy}>
              {busy ? 'Just a moment…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>}

          {!confirmation && <p className="auth-footnote">
            {mode === 'create' ? 'Already have an account? ' : 'Don’t have an account? '}
            <button type="button" className="auth-switch" onClick={() => changeMode(mode === 'login' ? 'create' : 'login')}>{mode === 'login' ? 'Sign Up' : 'Sign In'}</button>
          </p>}
        </div>
      </section>
    </main>
  );
}
