const turkishCharacters: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
};

export function generateCourseSlug(title: string): string {
  const transliterated = [...title.toLocaleLowerCase('tr-TR')]
    .map((character) => turkishCharacters[character] ?? character)
    .join('');

  return transliterated
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .replace(/-{2,}/gu, '-')
    .slice(0, 180)
    .replace(/-+$/gu, '');
}
