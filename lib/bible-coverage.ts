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

function coverageLevel(counts: number[], verseCount: number) {
  const totalVerseReads = counts.reduce((total, count) => total + count, 0);
  if (totalVerseReads === 0) return 0;
  const deepestRepeat = Math.max(...counts);
  const score = (totalVerseReads / verseCount) + Math.min(Math.max(deepestRepeat - 1, 0), 2) * 0.25;
  if (score < 0.3) return 1;
  if (score < 0.8) return 2;
  if (score < 1.4) return 3;
  if (score < 2.4) return 4;
  return 5;
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
        level: coverageLevel(counts, verseCount),
      };
    });
    if (bookUniqueVerses > 0) booksStarted += 1;
    return {
      id: book.id,
      name: book.name,
      chapters,
      uniqueVerses: bookUniqueVerses,
      totalVerses: book.verseCounts.reduce((total, count) => total + count, 0),
    };
  });

  const totalVerses = BIBLE_BOOKS.reduce(
    (total, book) => total + book.verseCounts.reduce((bookTotal, count) => bookTotal + count, 0),
    0,
  );

  return {
    books,
    uniqueVerses,
    totalVerses,
    totalVerseReads,
    booksStarted,
    percentCovered: totalVerses === 0 ? 0 : (uniqueVerses / totalVerses) * 100,
  };
}
