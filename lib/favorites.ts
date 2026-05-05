export interface FavoriteItem {
  type: "used" | "dealer" | "part";
  id: number;
}

const STORAGE_KEY = "carFavorites";

function migrate(): FavoriteItem[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    if (parsed.length === 0) return [];
    if (typeof parsed[0] === "number") {
      const migrated: FavoriteItem[] = parsed.map((id: number) => ({ type: "used" as const, id }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return parsed as FavoriteItem[];
  } catch {
    return [];
  }
}

export function getFavorites(): FavoriteItem[] {
  return migrate();
}

export function isFavorite(type: FavoriteItem["type"], id: number): boolean {
  return getFavorites().some((f) => f.type === type && f.id === id);
}

export function toggleFavorite(type: FavoriteItem["type"], id: number): FavoriteItem[] {
  const current = getFavorites();
  const exists = current.findIndex((f) => f.type === type && f.id === id);
  const next = exists >= 0
    ? current.filter((_, i) => i !== exists)
    : [...current, { type, id }];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function getFavoritesByType(type: FavoriteItem["type"]): number[] {
  return getFavorites().filter((f) => f.type === type).map((f) => f.id);
}
