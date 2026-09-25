'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, CalendarDays, NotebookPen } from 'lucide-react';

import { AppHeader } from '@/components/app-header';
import { StatusToast } from '@/components/status-toast';
import { buttonVariants } from '@/components/ui/button';
import { fetchCurrentUser, readJson, type User } from '@/lib/client';

type Reading = {
  id: string;
  readingDate: string;
  passage: string;
  verseCount: number;
  reflection: string;
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

export default function ReflectionsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const reflections = useMemo(() => readings.filter((reading) => reading.reflection.trim()), [readings]);

  useEffect(() => {
    Promise.all([
      fetchCurrentUser(),
      fetch('/api/readings', { cache: 'no-store' }).then((response) => readJson<{ readings: Reading[] }>(response)),
    ])
      .then(([currentUser, data]) => {
        setUser(currentUser);
        setReadings(data.readings);
      })
      .catch((error: Error) => setStatus({ message: error.message, tone: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 4200);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (loading || !user) {
    return <main className="page-loading"><span className="loading-mark"><NotebookPen /></span><p>Opening your reflections…</p></main>;
  }

  return (
    <div className="app-shell">
      <AppHeader name={`${user.firstName} ${user.lastName}`} active="reflections" />
      <main className="reflections-main">
        <div className="teams-title-row reflections-title-row">
          <a href="/home" className={buttonVariants({ variant: 'outline', size: 'lg' })} onClick={(event) => { event.preventDefault(); window.location.assign('/home'); }}><ArrowLeft aria-hidden="true" /> Back home</a>
          <div><p className="eyebrow">Look back and remember</p><h1>Reflections</h1><p>Your notes from time spent in Scripture.</p></div>
        </div>

        <section className="reflections-panel" aria-labelledby="your-reflections-title">
          <div className="section-heading reflections-heading">
            <div className="section-icon"><NotebookPen aria-hidden="true" /></div>
            <div><h2 id="your-reflections-title">Your Reflections</h2></div>
            <span className="reflection-count">{reflections.length} {reflections.length === 1 ? 'reflection' : 'reflections'}</span>
          </div>

          {reflections.length === 0 ? (
            <div className="empty-teams empty-reflections">
              <span><BookOpen /></span>
              <h3>Your reflection journal is ready.</h3>
              <p>Add an optional reflection when you log a reading, and it will appear here.</p>
            </div>
          ) : (
            <div className="reflection-list">
              {reflections.map((reading) => (
                <article className="reflection-card" key={reading.id}>
                  <header>
                    <time dateTime={reading.readingDate}><CalendarDays aria-hidden="true" /> {displayDate(reading.readingDate)}</time>
                    <span>{reading.verseCount} {reading.verseCount === 1 ? 'verse' : 'verses'}</span>
                  </header>
                  <h2>{reading.passage}</h2>
                  <p>{reading.reflection}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      {status && <StatusToast message={status.message} tone={status.tone} />}
    </div>
  );
}
