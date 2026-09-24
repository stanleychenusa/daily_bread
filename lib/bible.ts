import AwokenRef from 'awoken-bible-reference';

export type BibleRangeInput = {
  book: string;
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
};

export type BibleBook = {
  id: string;
  name: string;
  verseCounts: number[];
};

export const BIBLE_BOOKS: BibleBook[] = AwokenRef.versification.order.map((book) => ({
  id: book.id,
  name: book.name,
  verseCounts: book.chapters.map((chapter) => chapter.verse_count),
}));

const BIBLE_BOOK_MAP = new Map(BIBLE_BOOKS.map((book) => [book.id, book]));

export function getBibleBook(bookId: string) {
  return BIBLE_BOOK_MAP.get(bookId);
}

export function isBibleRangeInput(value: unknown): value is BibleRangeInput {
  if (!value || typeof value !== 'object') return false;
  const range = value as Record<string, unknown>;
  return typeof range.book === 'string'
    && Number.isInteger(range.startChapter)
    && Number.isInteger(range.startVerse)
    && Number.isInteger(range.endChapter)
    && Number.isInteger(range.endVerse);
}

export function validateBibleRange(range: BibleRangeInput) {
  const book = getBibleBook(range.book);
  if (!book) return 'Choose a valid Bible book.';

  const chapterCount = book.verseCounts.length;
  if (range.startChapter < 1 || range.startChapter > chapterCount) return `Choose a valid starting chapter in ${book.name}.`;
  if (range.endChapter < 1 || range.endChapter > chapterCount) return `Choose a valid ending chapter in ${book.name}.`;

  const startChapterVerses = book.verseCounts[range.startChapter - 1];
  const endChapterVerses = book.verseCounts[range.endChapter - 1];
  if (range.startVerse < 1 || range.startVerse > startChapterVerses) return `Choose a valid starting verse in ${book.name} ${range.startChapter}.`;
  if (range.endVerse < 1 || range.endVerse > endChapterVerses) return `Choose a valid ending verse in ${book.name} ${range.endChapter}.`;
  if (range.endChapter < range.startChapter || (range.endChapter === range.startChapter && range.endVerse < range.startVerse)) {
    return 'The ending verse must come after the starting verse.';
  }
  return null;
}

export function countBibleRange(range: BibleRangeInput) {
  const book = getBibleBook(range.book);
  if (!book || validateBibleRange(range)) return 0;
  if (range.startChapter === range.endChapter) return range.endVerse - range.startVerse + 1;

  let total = book.verseCounts[range.startChapter - 1] - range.startVerse + 1;
  for (let chapter = range.startChapter + 1; chapter < range.endChapter; chapter += 1) {
    total += book.verseCounts[chapter - 1];
  }
  return total + range.endVerse;
}

export function formatBibleRange(range: BibleRangeInput) {
  const book = getBibleBook(range.book);
  if (!book || validateBibleRange(range)) return '';

  const start = `${book.name} ${range.startChapter}:${range.startVerse}`;
  if (range.startChapter === range.endChapter && range.startVerse === range.endVerse) return start;
  if (range.startChapter === range.endChapter) return `${start}–${range.endVerse}`;
  return `${start}–${range.endChapter}:${range.endVerse}`;
}
