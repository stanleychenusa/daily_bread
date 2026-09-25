'use client';

import { Fragment, useMemo, type CSSProperties } from 'react';
import { BookOpen } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { buildBibleCoverage } from '@/lib/bible-coverage';

type Reading = { passage: string };

function formatPercent(value: number) {
  if (value === 0) return '0%';
  if (value < 0.1) return '<0.1%';
  return `${value.toFixed(value < 10 ? 1 : 0)}%`;
}

export function BibleCoverage({ readings }: { readings: Reading[] }) {
  const coverage = useMemo(() => buildBibleCoverage(readings), [readings]);

  return (
    <section className="coverage-section" aria-labelledby="bible-coverage-title">
      <div className="section-heading coverage-heading">
        <div className="coverage-title-group">
          <div className="section-icon"><BookOpen aria-hidden="true" /></div>
          <div>
            <h2 id="bible-coverage-title">Your Bible Coverage</h2>
            <p>Each square is a chapter. Re-reading Scripture deepens its color.</p>
          </div>
        </div>
        <div className="coverage-legend" aria-label="Chapter reading depth: less to more">
          <span>Less</span>
          {[0, 1, 2, 3, 4, 5].map((level) => <i key={level} className={`coverage-swatch coverage-level-${level}`} />)}
          <span>More</span>
        </div>
      </div>

      <div className="coverage-summary" aria-label="Bible coverage summary">
        <div><strong>{formatPercent(coverage.percentCovered)}</strong><small>Bible Covered</small></div>
        <div><strong>{coverage.uniqueVerses.toLocaleString()}</strong><small>Unique Verses</small></div>
        <div><strong>{coverage.booksStarted} / 66</strong><small>Books Started</small></div>
      </div>

      <TooltipProvider delay={100}>
        <div className="coverage-map" aria-label={`${coverage.uniqueVerses.toLocaleString()} of ${coverage.totalVerses.toLocaleString()} Bible verses covered`}>
          {coverage.books.map((book, bookIndex) => (
            <Fragment key={book.id}>
              {(bookIndex === 0 || bookIndex === 39) && (
                <div className="testament-label">
                  <span>{bookIndex === 0 ? 'Old Testament' : 'New Testament'}</span>
                </div>
              )}
              <div className="coverage-book-row">
                <span
                  className="coverage-book-name"
                  title={`${book.name}: ${book.uniqueVerses.toLocaleString()} of ${book.totalVerses.toLocaleString()} verses covered`}
                >
                  {book.name}
                </span>
                <div
                  className="coverage-chapters"
                  style={{ '--chapter-count': book.chapters.length } as CSSProperties}
                >
                  {book.chapters.map((chapter) => {
                    const verseWord = chapter.uniqueVerses === 1 ? 'verse' : 'verses';
                    const readWord = chapter.totalVerseReads === 1 ? 'read' : 'reads';
                    const detail = chapter.totalVerseReads === 0
                      ? `No verses covered yet`
                      : `${chapter.uniqueVerses} of ${chapter.verseCount} ${verseWord} covered · ${chapter.totalVerseReads} total verse ${readWord}`;
                    return (
                      <Tooltip key={chapter.chapter}>
                        <TooltipTrigger
                          render={(
                            <span
                              className={`coverage-cell coverage-level-${chapter.level}`}
                              role="img"
                              tabIndex={chapter.totalVerseReads > 0 ? 0 : undefined}
                              aria-label={`${book.name} ${chapter.chapter}: ${detail}`}
                            />
                          )}
                        />
                        <TooltipContent className="coverage-tooltip">
                          <span>{book.name} {chapter.chapter}</span>
                          <strong>{chapter.uniqueVerses} of {chapter.verseCount} verses covered</strong>
                          <small>{chapter.totalVerseReads} total verse {readWord}</small>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </TooltipProvider>
    </section>
  );
}
