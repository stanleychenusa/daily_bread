'use client';

import { Home, LogOut, NotebookPen, Users } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

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
        <Link className="app-brand" href="/home" aria-label="Daily Bread home">
          <span className="app-brand-mark" aria-hidden="true">🍞</span>
          <span><strong>Daily Bread</strong><small>Your daily portion of Scripture.</small></span>
        </Link>
        <nav className="header-actions" aria-label="Account navigation">
          <span className="user-chip"><span>{name.slice(0, 1).toUpperCase()}</span>{name}</span>
          {navigation.filter((item) => item.key !== active).map((item) => {
            const Icon = item.icon;
            return (
              <Button key={item.key} render={<Link href={item.href} />} variant="outline" size="lg" className="header-button">
                <Icon aria-hidden="true" /> {item.label}
              </Button>
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
