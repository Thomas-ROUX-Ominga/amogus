let wordSet: Set<string> | null = null;

/**
 * Normalise une chaîne : minuscules + suppression des diacritiques (accents).
 * ex: "Éléphant" → "elephant"
 */
export function normalize(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Vérifie si un mot existe dans le dictionnaire français.
 * Le dictionnaire est chargé en lazy loading une seule fois.
 */
export async function wordExists(word: string): Promise<boolean> {
  if (!wordSet) {
    const words = (await import("an-array-of-french-words")).default as string[];
    // Le dictionnaire contient des entrées non-accentuées, on normalise les deux côtés
    wordSet = new Set(words.map((w) => normalize(w)));
  }

  return wordSet.has(normalize(word));
}

/**
 * Vérifie si une entité existe sur Wikidata.
 */
export async function wikidataExists(word: string): Promise<boolean> {
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
      word
    )}&language=fr&format=json&origin=*`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.search || data.search.length === 0) return false;

    const normalizedInput = normalize(word);
    return data.search.some((item: { label: string }) => normalize(item.label) === normalizedInput);
  } catch (error) {
    console.error("Wikidata API error:", error);
    return false;
  }
}

/**
 * Valide un mot en fonction de son type de catégorie.
 */
export async function isCategoryValid(
  word: string,
  categoryType: "common" | "proper"
): Promise<boolean> {
  console.log({
    word,
    categoryType,
    wikidataExists: await wikidataExists(word),
    wordExists: await wordExists(word),
  });
  if (categoryType === "proper") {
    return wikidataExists(word);
  }
  return wordExists(word);
}
