import { BIBLE_BOOKS, parseBiblePassage } from '@/lib/bible';

export type CoverageReading = { passage: string };

export type ChapterCoverage = {
  chapter: number;
  verseCount: number;
  uniqueVerses: number;
  totalVerseReads: number;
  level: number;
};

export type BookCoverage = {
  id: string;
  name: string;
  chapters: ChapterCoverage[];
  uniqueVerses: number;
  totalVerses: number;
};

export type VerseCoverageBlock = {
  id: number;
  rangeLabel: string;
  verseCount: number;
  uniqueVerses: number;
  totalVerseReads: number;
  rereadVerseCount: number;
  level: number;
};

type CoveredVerse = {
  bookId: string;
  bookName: string;
  chapter: number;
  verse: number;
  reads: number;
};

const COVERAGE_COLUMNS = 41;
const COVERAGE_ROWS = 30;
const COVERAGE_BLOCK_COUNT = COVERAGE_COLUMNS * COVERAGE_ROWS;

function coverageLevel(counts: number[]) {
  const totalVerseReads = counts.reduce((total, count) => total + count, 0);
  if (totalVerseReads === 0) return 0;
  const uniqueVerses = counts.filter((count) => count > 0).length;
  const rereadVerseCount = counts.filter((count) => count > 1).length;
  const extraReads = totalVerseReads - uniqueVerses;
  const coverageRatio = uniqueVerses / counts.length;
  let level = coverageRatio < 0.34 ? 1 : coverageRatio < 0.84 ? 2 : 3;

  // Any reread deepens the block, even when only part of it was reread.
  if (rereadVerseCount > 0) level += 1;
  if (extraReads >= counts.length || counts.some((count) => count >= 3)) level += 1;
  return Math.min(level, 5);
}

function verseLabel(verse: CoveredVerse) {
  return `${verse.bookName} ${verse.chapter}:${verse.verse}`;
}

function blockRangeLabel(first: CoveredVerse, last: CoveredVerse) {
  if (first.bookId !== last.bookId) return `${verseLabel(first)}–${verseLabel(last)}`;
  if (first.chapter !== last.chapter) return `${verseLabel(first)}–${last.chapter}:${last.verse}`;
  if (first.verse === last.verse) return verseLabel(first);
  return `${verseLabel(first)}–${last.verse}`;
}

export function buildBibleCoverage(readings: CoverageReading[]) {
  const verseReads = new Map(
    BIBLE_BOOKS.map((book) => [book.id, book.verseCounts.map((verseCount) => Array<number>(verseCount).fill(0))]),
  );

  for (const reading of readings) {
    for (const range of parseBiblePassage(reading.passage)) {
      const book = BIBLE_BOOKS.find((candidate) => candidate.id === range.book);
      const bookReads = verseReads.get(range.book);
      if (!book || !bookReads) continue;

      for (let chapter = range.startChapter; chapter <= range.endChapter; chapter += 1) {
        const firstVerse = chapter === range.startChapter ? range.startVerse : 1;
        const lastVerse = chapter === range.endChapter ? range.endVerse : book.verseCounts[chapter - 1];
        for (let verse = firstVerse; verse <= lastVerse; verse += 1) {
          bookReads[chapter - 1][verse - 1] += 1;
        }
      }
    }
  }

  let uniqueVerses = 0;
  let totalVerseReads = 0;
  let booksStarted = 0;
  let booksFinished = 0;

  const books: BookCoverage[] = BIBLE_BOOKS.map((book) => {
    let bookUniqueVerses = 0;
    const chapters = book.verseCounts.map((verseCount, chapterIndex) => {
      const counts = verseReads.get(book.id)?.[chapterIndex] ?? [];
      const chapterUniqueVerses = counts.filter((count) => count > 0).length;
      const chapterTotalVerseReads = counts.reduce((total, count) => total + count, 0);
      bookUniqueVerses += chapterUniqueVerses;
      uniqueVerses += chapterUniqueVerses;
      totalVerseReads += chapterTotalVerseReads;
      return {
        chapter: chapterIndex + 1,
        verseCount,
        uniqueVerses: chapterUniqueVerses,
        totalVerseReads: chapterTotalVerseReads,
        level: coverageLevel(counts),
      };
    });
    const bookTotalVerses = book.verseCounts.reduce((total, count) => total + count, 0);
    if (bookUniqueVerses > 0) booksStarted += 1;
    if (bookUniqueVerses === bookTotalVerses) booksFinished += 1;
    return {
      id: book.id,
      name: book.name,
      chapters,
      uniqueVerses: bookUniqueVerses,
      totalVerses: bookTotalVerses,
    };
  });

  const totalVerses = BIBLE_BOOKS.reduce(
    (total, book) => total + book.verseCounts.reduce((bookTotal, count) => bookTotal + count, 0),
    0,
  );

  const verses: CoveredVerse[] = BIBLE_BOOKS.flatMap((book) =>
    book.verseCounts.flatMap((verseCount, chapterIndex) => {
      const counts = verseReads.get(book.id)?.[chapterIndex] ?? [];
      return Array.from({ length: verseCount }, (_, verseIndex) => ({
        bookId: book.id,
        bookName: book.name,
        chapter: chapterIndex + 1,
        verse: verseIndex + 1,
        reads: counts[verseIndex] ?? 0,
      }));
    }),
  );

  const blocks: VerseCoverageBlock[] = [];
  for (let index = 0; index < COVERAGE_BLOCK_COUNT; index += 1) {
    const start = Math.floor((index * verses.length) / COVERAGE_BLOCK_COUNT);
    const end = Math.floor(((index + 1) * verses.length) / COVERAGE_BLOCK_COUNT);
    const blockVerses = verses.slice(start, end);
    const counts = blockVerses.map((verse) => verse.reads);
    blocks.push({
      id: blocks.length,
      rangeLabel: blockRangeLabel(blockVerses[0], blockVerses[blockVerses.length - 1]),
      verseCount: blockVerses.length,
      uniqueVerses: counts.filter((count) => count > 0).length,
      totalVerseReads: counts.reduce((total, count) => total + count, 0),
      rereadVerseCount: counts.filter((count) => count > 1).length,
      level: coverageLevel(counts),
    });
  }

  return {
    books,
    blocks,
    uniqueVerses,
    totalVerses,
    totalVerseReads,
    booksStarted,
    booksFinished,
    percentCovered: totalVerses === 0 ? 0 : (uniqueVerses / totalVerses) * 100,
  };
}
