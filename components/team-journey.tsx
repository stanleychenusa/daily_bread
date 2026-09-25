'use client';

import { useMemo } from 'react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type Member = { id: string; firstName: string; lastName: string };
type JourneyReading = { userId: string; readingDate: string; verseCount: number };

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`));
}

export function TeamJourney({ members, readings }: { members: Member[]; readings: JourneyReading[] }) {
  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, `${member.firstName} ${member.lastName}`])),
    [members],
  );
  const readingsByDate = useMemo(() => {
    const grouped = new Map<string, Map<string, number>>();
    for (const reading of readings) {
      const day = grouped.get(reading.readingDate) ?? new Map<string, number>();
      day.set(reading.userId, (day.get(reading.userId) ?? 0) + reading.verseCount);
      grouped.set(reading.readingDate, day);
    }
    return grouped;
  }, [readings]);

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay()));
  const start = new Date(end);
  start.setDate(start.getDate() - 363);

  const memberScale = Math.max(1, members.length);
  const days = Array.from({ length: 364 }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    const dateKey = isoDate(date);
    const memberTotals = date > today ? new Map<string, number>() : readingsByDate.get(dateKey) ?? new Map<string, number>();
    const verses = [...memberTotals.values()].reduce((total, count) => total + count, 0);
    const level = verses === 0
      ? 0
      : verses <= 10 * memberScale
        ? 1
        : verses <= 25 * memberScale
          ? 2
          : verses <= 50 * memberScale
            ? 3
            : 4;
    return { dateKey, verses, level, future: date > today, memberTotals };
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

  return (
    <div className="team-journey-map" aria-label="Combined team reading activity over the last 52 weeks">
      <div className="heatmap-layout">
        <div className="month-labels" aria-hidden="true">
          {monthLabels.map((month) => (
            <span key={`${month.label}-${month.column}`} style={{ gridColumn: `${month.column + 1} / span 4` }}>{month.label}</span>
          ))}
        </div>
        <TooltipProvider delay={120}>
          <div className="heat-grid team-heat-grid">
            {days.map((day) => {
              const verseLabel = `${day.verses.toLocaleString()} ${day.verses === 1 ? 'verse' : 'verses'} together`;
              const breakdown = [...day.memberTotals.entries()]
                .map(([userId, verses]) => ({ name: memberNames.get(userId) ?? 'Team member', verses }))
                .sort((first, second) => second.verses - first.verses);
              return (
                <Tooltip key={day.dateKey}>
                    <TooltipTrigger
                      render={(
                      <button
                        type="button"
                        className={`heat-cell level-${day.level}${day.future ? ' future' : ''}`}
                        tabIndex={!day.future && day.verses > 0 ? 0 : -1}
                        aria-label={`${displayDate(day.dateKey)}: ${verseLabel}`}
                      />
                    )}
                  />
                  <TooltipContent className="reading-tooltip team-reading-tooltip">
                    <span>{displayDate(day.dateKey)}</span>
                    <strong>{verseLabel}</strong>
                    {breakdown.map((member) => (
                      <small key={member.name}>{member.name}: {member.verses.toLocaleString()}</small>
                    ))}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
