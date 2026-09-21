'use client';

import { Home, LogOut, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';

type AppHeaderProps = {
  name: string;
  active: 'home' | 'teams';
};

export function AppHeader({ name, active }: AppHeaderProps) {
  async function signOut() {
    await fetch('/api/auth/signout', { method: 'POST' });
    window.location.href = '/';
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="app-brand" href="/home" aria-label="Daily Bread home">
          <span className="app-brand-mark" aria-hidden="true">🍞</span>
          <span><strong>Daily Bread</strong><small>Your daily portion of Scripture.</small></span>
        </a>
        <nav className="header-actions" aria-label="Account navigation">
          <span className="user-chip"><span>{name.slice(0, 1).toUpperCase()}</span>{name}</span>
          <Button render={<a href={active === 'teams' ? '/home' : '/teams'} />} variant="outline" size="lg" className="header-button">
            {active === 'teams' ? <Home aria-hidden="true" /> : <Users aria-hidden="true" />}
            {active === 'teams' ? 'Home' : 'Teams'}
          </Button>
          <Button type="button" variant="ghost" size="lg" className="header-button signout-button" onClick={signOut}>
            <LogOut aria-hidden="true" /> Sign out
          </Button>
        </nav>
      </div>
    </header>
  );
}
