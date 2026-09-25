'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, NotebookPen, Trash2 } from 'lucide-react';

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
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type Reading = { id: string; readingDate: string; passage: string; verseCount: number; reflection: string };

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

export function ReadingHeatmap({
  readings,
  onClearDay,
}: {
  readings: Reading[];
  onClearDay: (readingDate: string) => Promise<void>;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const readingsByDate = useMemo(() => {
    const grouped = new Map<string, Reading[]>();
    for (const reading of readings) {
      grouped.set(reading.readingDate, [...(grouped.get(reading.readingDate) ?? []), reading]);
    }
    return grouped;
  }, [readings]);
  const totals = new Map<string, number>();
  for (const reading of readings) totals.set(reading.readingDate, (totals.get(reading.readingDate) ?? 0) + reading.verseCount);

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay()));
  const start = new Date(end);
  start.setDate(start.getDate() - 363);

  const days = Array.from({ length: 364 }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    const dateKey = isoDate(date);
    const verses = date > today ? 0 : totals.get(dateKey) ?? 0;
    const level = verses === 0 ? 0 : verses <= 10 ? 1 : verses <= 25 ? 2 : verses <= 50 ? 3 : 4;
    return { dateKey, verses, level, future: date > today };
  });

  const monthLabels: { label: string; column: number }[] = [];
  let lastMonth = -1;
  for (let column = 0; column < 52; column += 1) {
    const date = new Date(start);
    date.setDate(date.getDate() + column * 7);
    if (date.getMonth() !== lastMonth) {
      monthLabels.push({ label: date.toLocaleDateString('en-US', { month: 'short' }), column });
      lastMonth = date.getMonth();
    }
  }

  const selectedReadings = selectedDate ? readingsByDate.get(selectedDate) ?? [] : [];
  const selectedTotal = selectedReadings.reduce((total, reading) => total + reading.verseCount, 0);

  async function clearSelectedDay() {
    if (!selectedDate) return;
    setClearing(true);
    try {
      await onClearDay(selectedDate);
      setConfirmingClear(false);
      setSelectedDate(null);
    } catch {
      // The parent keeps the dialog open and surfaces the error in its status toast.
    } finally {
      setClearing(false);
    }
  }

  return (
    <section className="activity-section" aria-labelledby="reading-activity-title">
      <div className="section-heading activity-heading">
        <div>
          <h2 id="reading-activity-title">Your Reading Journey</h2>
        </div>
        <div className="heat-legend" aria-label="Reading volume: less to more">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => <i key={level} className={`heat-cell level-${level}`} />)}
          <span>More</span>
        </div>
      </div>

      <div className="heatmap-scroll" aria-label="Daily Scripture reading activity over the last 52 weeks">
        <div className="heatmap-layout">
          <div className="month-labels" aria-hidden="true">
            {monthLabels.map((month) => <span key={`${month.label}-${month.column}`} style={{ gridColumn: `${month.column + 1} / span 4` }}>{month.label}</span>)}
          </div>
          <TooltipProvider delay={120}>
            <div className="heat-grid">
              {days.map((day) => {
                const verseLabel = `${day.verses} ${day.verses === 1 ? 'verse' : 'verses'}`;
                return (
                  <Tooltip key={day.dateKey}>
                    <TooltipTrigger
                      render={(
                        <button
                          type="button"
                          className={`heat-cell level-${day.level}${day.future ? ' future' : ''}`}
                          aria-label={`${displayDate(day.dateKey)}: ${verseLabel}. Select for details.`}
                          aria-disabled={day.future}
                          onClick={() => !day.future && setSelectedDate(day.dateKey)}
                        />
                      )}
                    />
                    <TooltipContent className="reading-tooltip">
                      <span>{displayDate(day.dateKey)}</span>
                      <strong>{verseLabel}</strong>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </div>
      </div>

      <Dialog open={selectedDate !== null} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="reading-day-dialog">
          <DialogHeader>
            <span className="reading-day-icon"><CalendarDays aria-hidden="true" /></span>
            <DialogTitle>{selectedDate ? displayDate(selectedDate) : 'Reading details'}</DialogTitle>
            <DialogDescription>
              {selectedTotal} {selectedTotal === 1 ? 'verse' : 'verses'} read on this day
            </DialogDescription>
          </DialogHeader>

          {selectedReadings.length > 0 ? (
            <ul className="reading-day-list">
              {selectedReadings.map((reading) => (
                <li key={reading.id}>
                  <div className="reading-day-summary">
                    <span>{reading.passage}</span>
                    <strong>{reading.verseCount} {reading.verseCount === 1 ? 'verse' : 'verses'}</strong>
                  </div>
                  {reading.reflection && (
                    <p className="reading-day-reflection">
                      <NotebookPen aria-hidden="true" />
                      <span>{reading.reflection}</span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="reading-day-empty">No reading was logged for this day.</p>
          )}

          <DialogFooter className="reading-day-footer">
            <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
            {selectedReadings.length > 0 && (
              <Button variant="destructive" onClick={() => setConfirmingClear(true)}>
                <Trash2 aria-hidden="true" /> Clear this day
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmingClear} onOpenChange={setConfirmingClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia><Trash2 /></AlertDialogMedia>
            <AlertDialogTitle>Clear this day’s readings?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove everything logged for {selectedDate ? displayDate(selectedDate) : 'this day'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Keep readings</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={clearing} onClick={() => void clearSelectedDay()}>
              {clearing ? 'Clearing…' : 'Yes, clear this day'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
