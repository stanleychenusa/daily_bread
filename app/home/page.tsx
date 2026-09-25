'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, Plus, X } from 'lucide-react';

import { AppHeader } from '@/components/app-header';
import { BibleCoverage } from '@/components/bible-coverage';
import { ReadingHeatmap } from '@/components/heatmap';
import { StatusToast } from '@/components/status-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { BIBLE_BOOKS, countBibleRange, getBibleBook, validateBibleRange, type BibleRangeInput } from '@/lib/bible';
import { fetchCurrentUser, readJson, type User } from '@/lib/client';

type Reading = { id: string; readingDate: string; passage: string; verseCount: number; reflection: string };
type PassageDraft = BibleRangeInput & { wholeChapters: boolean };

function emptyPassage(): PassageDraft {
  return { book: '', startChapter: 1, startVerse: 1, endChapter: 1, endVerse: 1, wholeChapters: false };
}

function numberOptions(start: number, end: number) {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
}

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
  const [passages, setPassages] = useState<PassageDraft[]>([emptyPassage()]);
  const [reflection, setReflection] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const stats = useMemo(() => getStats(readings), [readings]);
  const previewCount = useMemo(() => passages.reduce((total, range) => total + countBibleRange(range), 0), [passages]);

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
    const rangeError = passages.map(validateBibleRange).find(Boolean);
    if (rangeError) {
      setStatus({ message: rangeError, tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          reflection,
          ranges: passages.map((range) => ({
            book: range.book,
            startChapter: range.startChapter,
            startVerse: range.startVerse,
            endChapter: range.endChapter,
            endVerse: range.endVerse,
          })),
        }),
      });
      const data = await readJson<{ reading: Reading }>(response);
      setReadings((current) => [data.reading, ...current]);
      setPassages([emptyPassage()]);
      setReflection('');
      setStatus({ message: `${data.reading.verseCount} ${data.reading.verseCount === 1 ? 'verse' : 'verses'} added to your rhythm.`, tone: 'success' });
    } catch (error) {
      setStatus({ message: error instanceof Error ? error.message : 'Could not add that reading.', tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  function updatePassage(index: number, updater: (current: PassageDraft) => PassageDraft) {
    setPassages((current) => current.map((range, rangeIndex) => rangeIndex === index ? updater(range) : range));
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
              <label htmlFor="reading-date">Date<Input id="reading-date" type="date" value={date} max={localDate()} onChange={(event) => setDate(event.target.value)} required /></label>
              <fieldset className="passage-builder">
                <legend>What did you read?</legend>
                <p className="passage-helper">Choose a starting and ending verse. Add another passage if you read from more than one place.</p>
                <div className="passage-list">
                  {passages.map((range, index) => {
                    const book = getBibleBook(range.book);
                    const chapterCount = book?.verseCounts.length ?? 0;
                    const startVerseCount = book?.verseCounts[range.startChapter - 1] ?? 0;
                    const endVerseCount = book?.verseCounts[range.endChapter - 1] ?? 0;
                    const firstEndVerse = range.endChapter === range.startChapter ? range.startVerse : 1;
                    const wholeChapterSummary = book && range.wholeChapters
                      ? range.startChapter === range.endChapter
                        ? `Every verse in ${book.name} ${range.startChapter} is included.`
                        : `Every verse from ${book.name} ${range.startChapter} through ${range.endChapter} is included.`
                      : '';

                    return (
                      <div className="passage-range-card" key={index}>
                        <div className="passage-range-heading">
                          <strong>Passage {index + 1}</strong>
                          {passages.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="remove-passage-button"
                              aria-label={`Remove passage ${index + 1}`}
                              onClick={() => setPassages((current) => current.filter((_, rangeIndex) => rangeIndex !== index))}
                            >
                              <X aria-hidden="true" /> Remove
                            </Button>
                          )}
                        </div>
                        <div className="passage-range-fields">
                          <label className="range-book-field" htmlFor={`passage-${index}-book`}>
                            Book
                            <NativeSelect
                              id={`passage-${index}-book`}
                              className="passage-select"
                              value={range.book}
                              required
                              onChange={(event) => updatePassage(index, () => ({ ...emptyPassage(), book: event.target.value }))}
                            >
                              <NativeSelectOption value="" disabled>Select a book</NativeSelectOption>
                              <NativeSelectOptGroup label="Old Testament">
                                {BIBLE_BOOKS.slice(0, 39).map((option) => <NativeSelectOption key={option.id} value={option.id}>{option.name}</NativeSelectOption>)}
                              </NativeSelectOptGroup>
                              <NativeSelectOptGroup label="New Testament">
                                {BIBLE_BOOKS.slice(39).map((option) => <NativeSelectOption key={option.id} value={option.id}>{option.name}</NativeSelectOption>)}
                              </NativeSelectOptGroup>
                            </NativeSelect>
                          </label>
                          <label htmlFor={`passage-${index}-start-chapter`}>
                            Start chapter
                            <NativeSelect
                              id={`passage-${index}-start-chapter`}
                              className="passage-select"
                              value={range.startChapter}
                              disabled={!book}
                              onChange={(event) => {
                                const chapter = Number(event.target.value);
                                const lastVerse = book?.verseCounts[chapter - 1] ?? 1;
                                updatePassage(index, (current) => ({
                                  ...current,
                                  startChapter: chapter,
                                  startVerse: 1,
                                  endChapter: chapter,
                                  endVerse: current.wholeChapters ? lastVerse : 1,
                                }));
                              }}
                            >
                              {numberOptions(1, chapterCount).map((chapter) => <NativeSelectOption key={chapter} value={chapter}>{chapter}</NativeSelectOption>)}
                            </NativeSelect>
                          </label>
                          <label htmlFor={`passage-${index}-start-verse`}>
                            Start verse
                            <NativeSelect
                              id={`passage-${index}-start-verse`}
                              className="passage-select"
                              value={range.startVerse}
                              disabled={!book || range.wholeChapters}
                              onChange={(event) => {
                                const verse = Number(event.target.value);
                                updatePassage(index, (current) => ({
                                  ...current,
                                  startVerse: verse,
                                  endVerse: current.endChapter === current.startChapter ? Math.max(current.endVerse, verse) : current.endVerse,
                                }));
                              }}
                            >
                              {numberOptions(1, startVerseCount).map((verse) => <NativeSelectOption key={verse} value={verse}>{verse}</NativeSelectOption>)}
                            </NativeSelect>
                          </label>
                          <span className="range-to" aria-hidden="true">to</span>
                          <label htmlFor={`passage-${index}-end-chapter`}>
                            End chapter
                            <NativeSelect
                              id={`passage-${index}-end-chapter`}
                              className="passage-select"
                              value={range.endChapter}
                              disabled={!book}
                              onChange={(event) => {
                                const chapter = Number(event.target.value);
                                const lastVerse = book?.verseCounts[chapter - 1] ?? 1;
                                updatePassage(index, (current) => ({
                                  ...current,
                                  endChapter: chapter,
                                  endVerse: current.wholeChapters
                                    ? lastVerse
                                    : chapter === current.startChapter ? current.startVerse : 1,
                                }));
                              }}
                            >
                              {numberOptions(range.startChapter, chapterCount).map((chapter) => <NativeSelectOption key={chapter} value={chapter}>{chapter}</NativeSelectOption>)}
                            </NativeSelect>
                          </label>
                          <label htmlFor={`passage-${index}-end-verse`}>
                            End verse
                            <NativeSelect
                              id={`passage-${index}-end-verse`}
                              className="passage-select"
                              value={range.endVerse}
                              disabled={!book || range.wholeChapters}
                              onChange={(event) => updatePassage(index, (current) => ({ ...current, endVerse: Number(event.target.value) }))}
                            >
                              {numberOptions(firstEndVerse, endVerseCount).map((verse) => <NativeSelectOption key={verse} value={verse}>{verse}</NativeSelectOption>)}
                            </NativeSelect>
                          </label>
                        </div>
                        <div className="passage-shortcuts">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={`whole-chapter-button${range.wholeChapters ? ' active' : ''}`}
                            aria-pressed={range.wholeChapters}
                            disabled={!book}
                            onClick={() => updatePassage(index, (current) => {
                              if (!book) return current;
                              if (current.wholeChapters) return { ...current, wholeChapters: false };
                              return {
                                ...current,
                                wholeChapters: true,
                                startVerse: 1,
                                endVerse: book.verseCounts[current.endChapter - 1] ?? 1,
                              };
                            })}
                          >
                            {range.wholeChapters ? <Check aria-hidden="true" /> : <BookOpen aria-hidden="true" />}
                            {range.wholeChapters ? 'Entire chapter(s) selected' : 'Use entire chapter(s)'}
                          </Button>
                          <span>
                            {wholeChapterSummary || 'Fills in every verse. Choose a later end chapter to include several full chapters.'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="add-passage-button"
                  disabled={passages.length >= 20}
                  onClick={() => setPassages((current) => [...current, emptyPassage()])}
                >
                  <Plus aria-hidden="true" /> Add another passage
                </Button>
              </fieldset>
              {previewCount > 0 && (
                <p className="verse-preview" aria-live="polite">
                  That looks like {previewCount} {previewCount === 1 ? 'verse' : 'verses'}.
                </p>
              )}
              <label className="reflection-field" htmlFor="reading-reflection">
                <span className="reflection-label-row"><span>Reflection</span><em>Optional</em></span>
                <Textarea
                  id="reading-reflection"
                  value={reflection}
                  maxLength={5_000}
                  rows={6}
                  placeholder="What stood out to you? What are you learning or praying about?"
                  onChange={(event) => setReflection(event.target.value)}
                />
                <small>{reflection.length.toLocaleString()} / 5,000 characters</small>
              </label>
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

        <BibleCoverage readings={readings} />

      </main>
      {status && <StatusToast message={status.message} tone={status.tone} />}
    </div>
  );
}
