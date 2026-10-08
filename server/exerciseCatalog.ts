import { pool } from "./db";
import {
  normalizeExerciseName,
  exerciseTokens,
  COMMON_ALIASES,
  IMAGE_OVERRIDES,
} from "../shared/exerciseNames";

// In-memory view of exercise_gif_cache (everything except the GIF bytes).
// ~1.4k rows; loaded once per worker and refreshed hourly. All name
// resolution, library listing and routine generation read from here so
// they agree on which animation and metadata an exercise has.

export type EquipmentCategory =
  | "barbell"
  | "dumbbell"
  | "cable"
  | "machine"
  | "kettlebell"
  | "bodyweight"
  | "band"
  | "other";

export interface CatalogEntry {
  name: string;
  key: string; // normalizeExerciseName(name)
  tokens: Set<string>;
  lowerName: string; // exact stored lowercase name
  exerciseDbId: string;
  bodyPart: string | null;
  equipment: string | null;
  targetMuscle: string | null;
  instructions: string | null;
  // Hand-curated famous names ("Barbell Bench Press") — stored Title
  // Case, unlike ExerciseDB's all-lowercase names.
  popular: boolean;
  equipmentCategory: EquipmentCategory;
  usesPullUpBar: boolean;
}

interface Catalog {
  entries: CatalogEntry[];
  byLowerName: Map<string, CatalogEntry>;
  byKey: Map<string, CatalogEntry[]>;
}

let cached: { at: number; catalog: Catalog } | null = null;
let loading: Promise<Catalog> | null = null;
const CATALOG_TTL_MS = 60 * 60 * 1000;

export function equipmentCategoryOf(
  equipment: string | null,
): EquipmentCategory {
  const e = (equipment || "").toLowerCase();
  if (!e) return "bodyweight";
  // Order matters: "ez barbell, exercise ball" is primarily a barbell move.
  if (e.includes("smith") || e.includes("leverage") || e.includes("sled"))
    return "machine";
  if (
    e.includes("machine") ||
    e.includes("assisted") ||
    e.includes("ergometer") ||
    e.includes("stationary bike") ||
    e.includes("elliptical") ||
    e.includes("skierg") ||
    e.includes("stepmill")
  )
    return "machine";
  if (e.includes("barbell") || e.includes("trap bar")) return "barbell";
  if (e.includes("dumbbell")) return "dumbbell";
  if (e.includes("cable") || e === "rope") return "cable";
  if (e.includes("kettlebell")) return "kettlebell";
  if (e.includes("band")) return "band";
  if (e.startsWith("body weight") || e === "weighted") return "bodyweight";
  return "other"; // stability/bosu/medicine ball, roller, tire, hammer…
}

const PULL_UP_BAR_PATTERN =
  /\b(pull ?-?ups?|chin ?-?ups?|hanging|muscle ?-?ups?|toes to bar|l-pull)\b/i;

function buildEntry(row: any): CatalogEntry {
  const name: string = row.exercise_name;
  return {
    name,
    key: normalizeExerciseName(name),
    tokens: new Set(exerciseTokens(name)),
    lowerName: name.toLowerCase().trim(),
    exerciseDbId: row.exercisedb_id,
    bodyPart: row.body_part,
    equipment: row.equipment,
    targetMuscle: row.target_muscle,
    instructions: row.instructions,
    popular: name !== name.toLowerCase(),
    equipmentCategory: equipmentCategoryOf(row.equipment),
    usesPullUpBar: PULL_UP_BAR_PATTERN.test(name),
  };
}

async function loadCatalog(): Promise<Catalog> {
  const result = await pool.query(
    `SELECT exercise_name, exercisedb_id, body_part, equipment, target_muscle, instructions
     FROM exercise_gif_cache
     WHERE exercisedb_id IS NOT NULL AND gif_data IS NOT NULL`,
  );
  const entries = result.rows.map(buildEntry);

  // Canonical ExerciseDB rows by id, for re-pointing curated rows.
  const canonicalById = new Map<string, CatalogEntry>();
  for (const e of entries) {
    if (!e.popular && !canonicalById.has(e.exerciseDbId)) {
      canonicalById.set(e.exerciseDbId, e);
    }
  }
  for (const e of entries) {
    const override = e.popular ? IMAGE_OVERRIDES[e.lowerName] : undefined;
    if (!override) continue;
    const overrideId = typeof override === "string" ? override : override.id;
    const canonical = canonicalById.get(overrideId);
    if (!canonical) continue;
    // The image decides what the movement is, so the metadata follows it
    // (e.g. "Pull-ups" was tagged "leverage machine" because it had
    // borrowed an assisted-machine animation) — unless the override
    // pins the equipment explicitly.
    e.exerciseDbId = canonical.exerciseDbId;
    e.bodyPart = canonical.bodyPart;
    e.targetMuscle = canonical.targetMuscle;
    e.instructions = canonical.instructions;
    e.equipment =
      typeof override === "string" ? canonical.equipment : override.equipment;
    e.equipmentCategory = equipmentCategoryOf(e.equipment);
  }

  const byLowerName = new Map<string, CatalogEntry>();
  const byKey = new Map<string, CatalogEntry[]>();
  for (const e of entries) {
    byLowerName.set(e.lowerName, e);
    if (!byKey.has(e.key)) byKey.set(e.key, []);
    byKey.get(e.key)!.push(e);
  }
  // Popular rows first within a key so they win ties.
  for (const list of byKey.values()) {
    list.sort((a, b) => Number(b.popular) - Number(a.popular));
  }
  return { entries, byLowerName, byKey };
}

export async function getCatalog(): Promise<Catalog> {
  if (cached && Date.now() - cached.at < CATALOG_TTL_MS) return cached.catalog;
  if (!loading) {
    loading = loadCatalog()
      .then((catalog) => {
        cached = { at: Date.now(), catalog };
        return catalog;
      })
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}

// Called after admin seed endpoints change the table.
export function invalidateCatalog(): void {
  cached = null;
}

// Words that describe HOW an exercise is done, not WHAT it is. A query
// made only of these ("barbell") is too vague to pick an image for.
const QUALIFIER_TOKENS = new Set([
  "barbell",
  "dumbbell",
  "cable",
  "lever",
  "smith",
  "band",
  "kettlebell",
  "weighted",
  "assisted",
  "machine",
  "standing",
  "seated",
  "lying",
  "one",
  "arm",
  "leg",
  "single",
  "double",
  "alternate",
  "with",
  "on",
  "the",
  "v",
  "2",
  "3",
  "male",
  "female",
]);

function hasCoreToken(tokens: string[]): boolean {
  return tokens.some((t) => !QUALIFIER_TOKENS.has(t));
}

// Resolve a free-form exercise name (from a routine, template, or the
// user's own custom exercise) to a catalog entry — or null. Returning
// null shows "no demo" instead of a WRONG animation; the old substring
// matcher picked the shortest name containing the query, so a custom
// name could inherit an unrelated exercise's GIF.
export async function resolveExercise(
  name: string,
): Promise<CatalogEntry | null> {
  const catalog = await getCatalog();
  const lower = name.toLowerCase().trim();
  if (!lower) return null;

  // 1. Exact stored name.
  const exact = catalog.byLowerName.get(lower);
  if (exact) return exact;

  // 2. Same name after normalization ("Push ups" == "push-ups").
  const key = normalizeExerciseName(name);
  const sameKey = catalog.byKey.get(key);
  if (sameKey?.length) return sameKey[0];

  // 3. Famous common name ("RDL", "bench press", "lat pulldown").
  const alias = COMMON_ALIASES.get(key);
  if (alias) {
    for (const target of alias) {
      const hit = catalog.byLowerName.get(target);
      if (hit) return hit;
    }
  }

  const queryTokens = exerciseTokens(name);
  if (!hasCoreToken(queryTokens)) return null;

  // 4. Every query token appears in the catalog name ("incline dumbbell
  //    press" → "Incline Dumbbell Press"), preferring curated names, then
  //    the fewest extra words. Too many extra words means it's a
  //    different variation — no match.
  let best: { entry: CatalogEntry; extra: number } | null = null;
  for (const e of catalog.entries) {
    if (!queryTokens.every((t) => e.tokens.has(t))) continue;
    const extra = e.tokens.size - queryTokens.length;
    if (extra > 2) continue;
    if (
      !best ||
      extra < best.extra ||
      (extra === best.extra && e.popular && !best.entry.popular)
    ) {
      best = { entry: e, extra };
    }
  }
  if (best) return best.entry;

  // 5. The catalog name is fully contained in a longer custom name
  //    ("my heavy barbell bench press" → "barbell bench press"). Needs a
  //    multi-word catalog name covering most of the query.
  let bestContained: CatalogEntry | null = null;
  const querySet = new Set(queryTokens);
  for (const e of catalog.entries) {
    if (e.tokens.size < 2) continue;
    if (![...e.tokens].every((t) => querySet.has(t))) continue;
    if (e.tokens.size / querySet.size < 0.6) continue;
    if (!bestContained || e.tokens.size > bestContained.tokens.size) {
      bestContained = e;
    }
  }
  return bestContained;
}

// ── Generation ranking ───────────────────────────────────────────────

// Plural-tolerant: curated names are plural ("Pull-ups", "Lunges"), and
// a bare \b after "up" fails on the trailing "s".
const COMPOUND_PATTERN =
  /\b(squat|deadlift|press|row|pull ?-?up|chin ?-?up|dip|lunge|clean|thrust|bridge|step ?-?up|pulldown|push ?-?up)(e?s)?\b/i;

export function isCompound(entry: CatalogEntry): boolean {
  return COMPOUND_PATTERN.test(entry.name);
}

// Higher = better pick for a generated routine. Curated famous lifts and
// mainstream equipment win; odd variants, stretches and gimmick
// equipment lose. (The old generator picked ORDER BY RANDOM(), so
// "potty squat with support" was as likely as a back squat.)
export function generationScore(entry: CatalogEntry): number {
  const n = entry.lowerName;
  if (/\bstretch\b/.test(n)) return -1000;
  if ((entry.targetMuscle || "").toLowerCase() === "cardiovascular system") {
    return -1000;
  }
  let score = 0;
  if (entry.popular) score += 60;
  if (isCompound(entry)) score += 15;
  if (entry.equipmentCategory === "other") score -= 40;
  if (/\bv\. ?\d\b/.test(n)) score -= 30;
  if (/\((male|female)\)/.test(n)) score -= 20;
  if (n.includes("(")) score -= 10;
  if (/\b(assisted|potty|throw|on stability|bosu)\b/.test(n)) score -= 25;
  score -= Math.max(0, entry.tokens.size - 3) * 6;
  return score;
}
