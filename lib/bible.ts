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
const BIBLE_BOOK_NAME_MAP = new Map(BIBLE_BOOKS.map((book) => [book.name.toLowerCase(), book]));

const BIBLE_BOOK_ALIASES = new Map([
  ['psalms', BIBLE_BOOK_NAME_MAP.get('psalm')],
  ['song of songs', BIBLE_BOOK_NAME_MAP.get('song of solomon')],
  ['revelations', BIBLE_BOOK_NAME_MAP.get('revelation')],
]);

export function getBibleBook(bookId: string) {
  return BIBLE_BOOK_MAP.get(bookId);
}

function getBibleBookByName(name: string) {
  const normalized = name.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  return BIBLE_BOOK_NAME_MAP.get(normalized) ?? BIBLE_BOOK_ALIASES.get(normalized);
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

export function parseBiblePassage(passage: string) {
  const ranges: BibleRangeInput[] = [];
  let activeBook: BibleBook | undefined;

  for (const rawSection of passage.split(';')) {
    const section = rawSection.trim();
    if (!section) continue;
    const expandedSection = activeBook && /^\d+\s*:/.test(section) ? `${activeBook.name} ${section}` : section;

    const canonical = expandedSection.match(/^(.+?)\s+(\d+):(\d+)(?:\s*[-–—]\s*(?:(\d+):)?(\d+))?$/);
    if (canonical) {
      const book = getBibleBookByName(canonical[1]);
      if (!book) continue;
      activeBook = book;
      const startChapter = Number(canonical[2]);
      const startVerse = Number(canonical[3]);
      const range: BibleRangeInput = {
        book: book.id,
        startChapter,
        startVerse,
        endChapter: canonical[4] ? Number(canonical[4]) : startChapter,
        endVerse: canonical[5] ? Number(canonical[5]) : startVerse,
      };
      if (!validateBibleRange(range)) ranges.push(range);
      continue;
    }

    // Support readings saved by the earlier free-text form, such as
    // "Luke 5:1-11, 17-26".
    const legacy = expandedSection.match(/^(.+?)\s+(\d+):(.+)$/);
    if (!legacy) continue;
    const book = getBibleBookByName(legacy[1]);
    if (!book) continue;
    activeBook = book;
    const chapter = Number(legacy[2]);

    for (const rawVerseRange of legacy[3].split(',')) {
      const verseMatch = rawVerseRange.trim().match(/^(\d+)(?:\s*[-–—]\s*(\d+))?$/);
      if (!verseMatch) continue;
      const startVerse = Number(verseMatch[1]);
      const range: BibleRangeInput = {
        book: book.id,
        startChapter: chapter,
        startVerse,
        endChapter: chapter,
        endVerse: verseMatch[2] ? Number(verseMatch[2]) : startVerse,
      };
      if (!validateBibleRange(range)) ranges.push(range);
    }
  }

  return ranges;
}
