'use client';

import { useMemo } from 'react';
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
          </div>
        </div>
        <div className="coverage-legend" aria-label="Verse-block reading depth: less to more">
          <span>Less</span>
          {[0, 1, 2, 3, 4, 5].map((level) => <i key={level} className={`coverage-swatch coverage-level-${level}`} />)}
          <span>More</span>
        </div>
      </div>

      <div className="coverage-summary" aria-label="Bible coverage summary">
        <div><strong>{formatPercent(coverage.percentCovered)}</strong><small>Bible Covered</small></div>
        <div><strong>{coverage.totalVerseReads.toLocaleString()}</strong><small>Total Verses</small></div>
        <div><strong>{coverage.booksStarted} / 66</strong><small>Books Started</small></div>
      </div>

      <TooltipProvider delay={100}>
        <div className="coverage-map" aria-label={`${coverage.uniqueVerses.toLocaleString()} of ${coverage.totalVerses.toLocaleString()} Bible verses covered`}>
          <div className="coverage-grid">
            {coverage.blocks.map((block) => {
              const verseWord = block.uniqueVerses === 1 ? 'verse' : 'verses';
              const readWord = block.totalVerseReads === 1 ? 'read' : 'reads';
              const rereadLabel = block.rereadVerseCount === 1 ? '1 verse reread' : `${block.rereadVerseCount} verses reread`;
              const detail = block.totalVerseReads === 0
                ? 'No verses covered yet'
                : `${block.uniqueVerses} of ${block.verseCount} ${verseWord} covered · ${block.totalVerseReads} total verse ${readWord}`;
              return (
                <Tooltip key={block.id}>
                  <TooltipTrigger
                    render={(
                      <span
                        className={`coverage-cell coverage-level-${block.level}`}
                        role="img"
                        tabIndex={block.totalVerseReads > 0 ? 0 : undefined}
                        aria-label={`${block.rangeLabel}: ${detail}`}
                      />
                    )}
                  />
                  <TooltipContent className="coverage-tooltip">
                    <span>{block.rangeLabel}</span>
                    <strong>{block.uniqueVerses} of {block.verseCount} verses covered</strong>
                    <small>{block.totalVerseReads} total verse {readWord}{block.rereadVerseCount > 0 ? ` · ${rereadLabel}` : ''}</small>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </TooltipProvider>
    </section>
  );
}
