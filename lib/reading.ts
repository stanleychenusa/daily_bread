export function countVerses(passage: string) {
  let total = 0;
  const bookSections = passage.split(';');

  for (const section of bookSections) {
    const colonIndex = section.indexOf(':');
    if (colonIndex === -1) continue;

    const versePart = section.slice(colonIndex + 1);
    for (const rawRange of versePart.split(',')) {
      const match = rawRange.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?/);
      if (!match) continue;
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : start;
      if (start > 0 && end >= start) total += end - start + 1;
    }
  }

  return total;
}
