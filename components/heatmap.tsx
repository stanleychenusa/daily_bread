'use client';

type Reading = { id: string; readingDate: string; passage: string; verseCount: number };

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

export function ReadingHeatmap({ readings }: { readings: Reading[] }) {
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

  return (
    <section className="activity-section" aria-labelledby="reading-activity-title">
      <div className="section-heading activity-heading">
        <div>
          <p className="eyebrow">A year at a glance</p>
          <h2 id="reading-activity-title">Your reading rhythm</h2>
          <p>Every little square is time you made for Scripture.</p>
        </div>
        <div className="heat-legend" aria-label="Reading volume: less to more">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => <i key={level} className={`heat-cell level-${level}`} />)}
          <span>More</span>
        </div>
      </div>

      <div className="heatmap-scroll" role="img" aria-label="Daily Scripture reading activity over the last 52 weeks">
        <div className="heatmap-layout">
          <div className="month-labels" aria-hidden="true">
            {monthLabels.map((month) => <span key={`${month.label}-${month.column}`} style={{ gridColumn: `${month.column + 1} / span 4` }}>{month.label}</span>)}
          </div>
          <div className="weekday-labels" aria-hidden="true"><span>Mon</span><span>Wed</span><span>Fri</span></div>
          <div className="heat-grid">
            {days.map((day) => (
              <span
                key={day.dateKey}
                className={`heat-cell level-${day.level}${day.future ? ' future' : ''}`}
                title={`${displayDate(day.dateKey)}: ${day.verses} ${day.verses === 1 ? 'verse' : 'verses'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
