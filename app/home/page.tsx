'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BookOpen, Plus, Trash2 } from 'lucide-react';

import { AppHeader } from '@/components/app-header';
import { ReadingHeatmap } from '@/components/heatmap';
import { StatusToast } from '@/components/status-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchCurrentUser, readJson, type User } from '@/lib/client';
import { countVerses } from '@/lib/reading';

type Reading = { id: string; readingDate: string; passage: string; verseCount: number };

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStats(readings: Reading[]) {
  const days = new Set(readings.map((reading) => reading.readingDate));
  const totalVerses = readings.reduce((total, reading) => total + reading.verseCount, 0);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const last30 = [...days].filter((day) => new Date(`${day}T12:00:00`) >= thirtyDaysAgo).length;

  let cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  if (!days.has(localDate(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(localDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { totalVerses, last30, streak };
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [date, setDate] = useState(localDate());
  const [passage, setPassage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [status, setStatus] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const stats = useMemo(() => getStats(readings), [readings]);
  const previewCount = countVerses(passage);

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

  async function addReading(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch('/api/readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, passage }),
      });
      const data = await readJson<{ reading: Reading }>(response);
      setReadings((current) => [data.reading, ...current]);
      setPassage('');
      setStatus({ message: `${data.reading.verseCount} verses added to your rhythm.`, tone: 'success' });
    } catch (error) {
      setStatus({ message: error instanceof Error ? error.message : 'Could not add that reading.', tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function clearReadings() {
    setClearingAll(true);
    try {
      await readJson<{ ok: boolean }>(await fetch('/api/readings', { method: 'DELETE' }));
      setReadings([]);
      setClearAllOpen(false);
      setStatus({ message: 'Your reading history has been cleared.', tone: 'success' });
    } catch (error) {
      setStatus({ message: error instanceof Error ? error.message : 'Could not clear your readings.', tone: 'error' });
    } finally {
      setClearingAll(false);
    }
  }

  async function clearReadingsForDate(readingDate: string) {
    try {
      await readJson<{ ok: boolean; readingDate: string }>(
        await fetch(`/api/readings?date=${encodeURIComponent(readingDate)}`, { method: 'DELETE' }),
      );
      setReadings((current) => current.filter((reading) => reading.readingDate !== readingDate));
      setStatus({ message: `The readings for ${readingDate} have been cleared.`, tone: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not clear that day.';
      setStatus({ message, tone: 'error' });
      throw error;
    }
  }

  if (loading || !user) {
    return <main className="page-loading"><span className="loading-mark"><BookOpen /></span><p>Setting the table…</p></main>;
  }

  return (
    <div className="app-shell">
      <AppHeader name={`${user.firstName} ${user.lastName}`} active="home" />
      <main className="dashboard-main">
        <section className="log-section" aria-labelledby="log-reading-title">
          <div className="log-card">
            <div className="section-heading">
              <div className="section-icon"><BookOpen aria-hidden="true" /></div>
              <div><h2 id="log-reading-title">Log Today’s Reading</h2></div>
            </div>
            <form className="reading-form" onSubmit={addReading}>
              <label>Date<Input type="date" value={date} max={localDate()} onChange={(event) => setDate(event.target.value)} required /></label>
              <label className="passage-field">
                What did you read?
                <Input value={passage} onChange={(event) => setPassage(event.target.value)} placeholder="e.g., Luke 5:1-11, 17-26; Psalm 23:1-6" required />
                <small>Use commas for verse ranges in the same chapter; semicolons for different chapters and different books.</small>
              </label>
              {previewCount > 0 && (
                <p className="verse-preview" aria-live="polite">
                  That looks like {previewCount} {previewCount === 1 ? 'verse' : 'verses'}.
                </p>
              )}
              <div className="reading-submit-row">
                <Button type="submit" size="lg" className="add-reading-button" disabled={saving}>
                  <Plus aria-hidden="true" /> {saving ? 'Adding…' : 'Add reading'}
                </Button>
              </div>
            </form>
            <div className="stats-card" aria-label="Reading statistics">
              <div className="stat-list">
                <div><strong>{stats.totalVerses.toLocaleString()}</strong><small>Total Verses</small></div>
                <div><strong>{stats.streak}</strong><small>Day Streak</small></div>
                <div><strong>{stats.last30}</strong><small>Days Read</small></div>
              </div>
            </div>
          </div>
        </section>

        <ReadingHeatmap readings={readings} onClearDay={clearReadingsForDate} />

        <section className="clear-section">
          <div><h2>Need a fresh start?</h2></div>
          <AlertDialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
            <AlertDialogTrigger render={<Button variant="destructive" size="lg" />}><Trash2 aria-hidden="true" /> Clear all data</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia><Trash2 /></AlertDialogMedia>
                <AlertDialogTitle>Clear your reading history?</AlertDialogTitle>
                <AlertDialogDescription>This permanently removes every logged reading and resets your reading statistics. This can’t be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={clearingAll}>Keep my readings</AlertDialogCancel>
                <AlertDialogAction variant="destructive" disabled={clearingAll} onClick={() => void clearReadings()}>
                  {clearingAll ? 'Clearing…' : 'Yes, clear my data'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </main>
      {status && <StatusToast message={status.message} tone={status.tone} />}
    </div>
  );
}
