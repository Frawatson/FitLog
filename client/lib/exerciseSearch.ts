import {
  normalizeExerciseName,
  exerciseTokens,
  COMMON_ALIASES,
} from "../../shared/exerciseNames";

export interface SearchableExercise {
  name: string;
  bodyPart?: string | null;
  equipment?: string | null;
  targetMuscle?: string | null;
  popular?: boolean;
}

// Queries that name a muscle or body region (normalized/singular form)
// mapped to the catalog's bodyPart / targetMuscle values. "chest" should
// mean "exercises that train the chest", well-known first — not "names
// containing the word chest" (which surfaced "isometric chest squeeze").
const MUSCLE_QUERIES: Record<string, string[]> = {
  chest: ["chest", "pectorals"],
  pec: ["chest", "pectorals"],
  back: ["back", "lats", "upper back", "spine"],
  lat: ["lats"],
  shoulder: ["shoulders", "delts"],
  delt: ["delts"],
  arm: ["upper arms", "lower arms"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  forearm: ["forearms", "lower arms"],
  leg: ["upper legs", "lower legs"],
  quad: ["quads"],
  hamstring: ["hamstrings"],
  glute: ["glutes"],
  calf: ["calves", "lower legs"],
  ab: ["abs", "waist"],
  core: ["abs", "waist"],
  trap: ["traps"],
  cardio: ["cardio", "cardiovascular system"],
};

// Ranked exercise search. Plain substring filtering buried "Barbell
// Bench Press" among ~30 alphabetical "bench press" variants and found
// nothing for "RDL", "OHP", "pullup" or "skullcrusher". Ranking:
//   alias of a famous lift > exact name > all words match (curated names
//   and shorter names first) > prefix of last word > muscle/equipment
//   match. Returns only matches, best first.
export function searchExercises<T extends SearchableExercise>(
  items: T[],
  query: string,
): T[] {
  const key = normalizeExerciseName(query);
  if (!key) return items;
  const queryTokens = key.split(" ");
  const lastToken = queryTokens[queryTokens.length - 1];
  const leadTokens = queryTokens.slice(0, -1);

  const aliasTargets = COMMON_ALIASES.get(key) ?? [];
  const aliasRank = new Map(aliasTargets.map((n, i) => [n, i]));
  const muscleValues = MUSCLE_QUERIES[key]
    ? new Set(MUSCLE_QUERIES[key])
    : null;

  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    const lower = item.name.toLowerCase();
    const nameKey = normalizeExerciseName(item.name);
    const tokens = exerciseTokens(item.name);
    let score = 0;

    if (muscleValues) {
      const trains =
        muscleValues.has((item.bodyPart || "").toLowerCase()) ||
        muscleValues.has((item.targetMuscle || "").toLowerCase());
      if (trains) {
        score = 6_000 + (item.popular ? 2_000 : 0) - tokens.length * 10;
      } else if (tokens.includes(key)) {
        score = 1_000;
      }
      if (score > 0) scored.push({ item, score });
      continue;
    }

    const aliasIndex = aliasRank.get(lower);
    if (aliasIndex !== undefined) {
      score = 10_000 - aliasIndex;
    } else if (nameKey === key) {
      score = 9_000;
    } else {
      const tokenSet = new Set(tokens);
      const leadOk = leadTokens.every((t) => tokenSet.has(t));
      const lastExact = tokenSet.has(lastToken);
      const lastPrefix =
        !lastExact && tokens.some((t) => t.startsWith(lastToken));
      if (leadOk && (lastExact || lastPrefix)) {
        score =
          (lastExact ? 5_000 : 3_000) +
          (item.popular ? 800 : 0) -
          // Fewer extra words = closer to what was typed.
          (tokens.length - queryTokens.length) * 40;
      } else {
        const meta = normalizeExerciseName(
          [item.bodyPart, item.targetMuscle, item.equipment]
            .filter(Boolean)
            .join(" "),
        );
        const metaTokens = new Set(meta.split(" "));
        if (queryTokens.every((t) => metaTokens.has(t))) {
          score = 1_000 + (item.popular ? 300 : 0) - tokens.length * 5;
        }
      }
    }
    if (score > 0) scored.push({ item, score });
  }
  scored.sort(
    (a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name),
  );
  return scored.map((s) => s.item);
}
