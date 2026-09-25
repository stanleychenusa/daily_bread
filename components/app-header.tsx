'use client';

import { Home, LogOut, NotebookPen, Users } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';

type AppHeaderProps = {
  name: string;
  active: 'home' | 'reflections' | 'teams';
};

export function AppHeader({ name, active }: AppHeaderProps) {
  const navigation = [
    { key: 'home', label: 'Home', href: '/home', icon: Home },
    { key: 'reflections', label: 'Reflections', href: '/reflections', icon: NotebookPen },
    { key: 'teams', label: 'Teams', href: '/teams', icon: Users },
  ] as const;

  async function signOut() {
    await fetch('/api/auth/signout', { method: 'POST' });
    window.location.href = '/';
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="app-brand" href="/home" onClick={(event) => { event.preventDefault(); window.location.assign('/home'); }}>
          <span className="app-brand-mark" aria-hidden="true">🍞</span>
          <span><strong>Daily Bread</strong><small>Your daily portion of Scripture.</small></span>
        </a>
        <nav className="header-actions" aria-label="Account navigation">
          <span className="user-chip"><span>{name.slice(0, 1).toUpperCase()}</span>{name}</span>
          {navigation.filter((item) => item.key !== active).map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.key}
                href={item.href}
                className={buttonVariants({ variant: 'outline', size: 'lg', className: 'header-button' })}
                onClick={(event) => {
                  event.preventDefault();
                  window.location.assign(item.href);
                }}
              >
                <Icon aria-hidden="true" /> {item.label}
              </a>
            );
          })}
          <Button type="button" variant="ghost" size="lg" className="header-button signout-button" onClick={signOut}>
            <LogOut aria-hidden="true" /> Sign out
          </Button>
        </nav>
      </div>
    </header>
  );
}
