// Exercise-name normalization, common-name aliases, and image overrides.
// Shared by the server (image resolution, library, routine generation)
// and the client (library / exercise-picker search) so both sides agree
// on what "the same exercise" means.

// ── Normalization ─────────────────────────────────────────────────────

// Token-level synonyms applied after splitting. Keys are what users type;
// values are the catalog's vocabulary.
const TOKEN_SYNONYMS: Record<string, string> = {
  db: "dumbbell",
  bb: "barbell",
  kb: "kettlebell",
  pullup: "pull up",
  pullups: "pull up",
  pushup: "push up",
  pushups: "push up",
  chinup: "chin up",
  chinups: "chin up",
  situp: "sit up",
  situps: "sit up",
  pressup: "push up",
  flye: "fly",
  flyes: "fly",
  flies: "fly",
  tricep: "triceps",
  bicep: "biceps",
  skullcrusher: "skull crusher",
  skullcrushers: "skull crusher",
};

const IRREGULAR_PLURALS: Record<string, string> = {
  calves: "calf",
};

// Plural → singular, conservative. "press"/"cross"/"triceps"/"biceps"
// must survive; "squats" → "squat", "ups" → "up", "raises" → "raise".
// Applied identically to both sides of every comparison, so an
// imperfect singular ("abs" → "ab") is harmless.
function singularize(token: string): string {
  if (IRREGULAR_PLURALS[token]) return IRREGULAR_PLURALS[token];
  if (token.length <= 2) return token;
  if (token === "triceps" || token === "biceps") return token;
  if (token.endsWith("ss") || token.endsWith("us")) return token;
  if (token.endsWith("ies")) return token.slice(0, -3) + "y";
  if (token.endsWith("ches") || token.endsWith("shes")) {
    return token.slice(0, -2);
  }
  if (token.endsWith("s")) return token.slice(0, -1);
  return token;
}

// Canonical comparable form: lowercase, punctuation and hyphens to spaces,
// synonyms expanded, tokens singularized. "Push-ups" and "push up" and
// "pushups" all normalize to "push up".
export function normalizeExerciseName(input: string): string {
  const raw = input
    .toLowerCase()
    .replace(/°/g, " degree ")
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!raw) return "";
  return raw
    .split(/\s+/)
    .map((t) => TOKEN_SYNONYMS[t] ?? t)
    .join(" ")
    .split(/\s+/)
    .map(singularize)
    .join(" ");
}

export function exerciseTokens(input: string): string[] {
  const n = normalizeExerciseName(input);
  return n ? n.split(" ") : [];
}

// ── Common-name aliases ──────────────────────────────────────────────
// What people actually call famous lifts → catalog names (lowercase,
// exactly as stored). Targets are listed best-first. Only names that
// exist in the catalog belong here; a missing target just doesn't match.
// Keys are normalized at module load, so write them naturally.
const RAW_ALIASES: Record<string, string[]> = {
  "bench press": ["barbell bench press"],
  bench: ["barbell bench press"],
  "flat bench": ["barbell bench press"],
  "incline bench": ["barbell incline bench press", "incline dumbbell press"],
  "incline press": ["incline dumbbell press", "barbell incline bench press"],
  "decline bench": ["barbell decline bench press"],
  "dumbbell press": ["dumbbell bench press"],
  "close grip bench": ["close grip bench press"],
  squat: ["barbell back squat", "barbell full squat"],
  "back squat": ["barbell back squat", "barbell full squat"],
  "front squat": ["front squats", "barbell front squat"],
  "goblet squat": ["goblet squats"],
  "split squat": ["split squats"],
  "bulgarian split squat": ["split squats"],
  deadlift: ["deadlift", "barbell deadlift"],
  "sumo deadlift": ["barbell sumo deadlift"],
  "trap bar deadlift": ["trap bar deadlift"],
  rdl: ["romanian deadlift", "barbell romanian deadlift"],
  "romanian deadlift": ["romanian deadlift", "barbell romanian deadlift"],
  ohp: ["barbell seated overhead press", "dumbbell standing overhead press"],
  "overhead press": [
    "barbell seated overhead press",
    "dumbbell standing overhead press",
  ],
  "military press": ["barbell seated overhead press"],
  "shoulder press": [
    "dumbbell seated shoulder press",
    "barbell seated overhead press",
  ],
  "pull up": ["pull-ups", "pull-up"],
  "chin up": ["chin-ups", "chin-up"],
  "push up": ["push-ups", "push-up"],
  dip: ["chest dip", "triceps dip", "tricep dips (bench)"],
  "lat pulldown": ["lat pulldown", "cable pulldown"],
  "lat pull down": ["lat pulldown", "cable pulldown"],
  pulldown: ["lat pulldown", "cable pulldown"],
  row: ["barbell bent over row", "bent over dumbbell rows", "pendlay row"],
  "barbell row": ["barbell bent over row", "pendlay row"],
  "bent over row": ["barbell bent over row", "bent over dumbbell rows"],
  "dumbbell row": ["bent over dumbbell rows", "dumbbell bent over row"],
  "one arm row": ["bent over dumbbell rows", "dumbbell bent over row"],
  "cable row": ["seated cable row", "cable seated row"],
  "seated row": ["seated cable row", "cable seated row"],
  "t bar row": ["t-bar row"],
  curl: ["dumbbell bicep curls", "barbell curls"],
  "biceps curl": ["dumbbell bicep curls", "barbell curls"],
  "skull crusher": ["skull crushers"],
  "lying triceps extension": ["skull crushers"],
  "triceps pushdown": ["rope pushdowns", "cable pushdown"],
  pushdown: ["rope pushdowns", "cable pushdown"],
  "rope pushdown": ["rope pushdowns"],
  fly: ["dumbbell flyes", "cable middle fly", "cable crossover"],
  "chest fly": ["dumbbell flyes", "cable middle fly"],
  "pec fly": ["dumbbell flyes", "cable middle fly"],
  "lateral raise": ["lateral raises", "dumbbell lateral raise"],
  "side raise": ["lateral raises", "dumbbell lateral raise"],
  "rear delt fly": ["dumbbell reverse fly"],
  "reverse fly": ["dumbbell reverse fly"],
  "face pull": ["cable rear delt row (with rope)"],
  "hip thrust": ["glute bridge", "barbell glute bridge"],
  lunge: ["lunges", "walking lunge", "dumbbell lunge"],
  "leg curl": ["lying leg curls", "seated leg curls"],
  "hamstring curl": ["lying leg curls", "seated leg curls"],
  "leg extension": ["leg extensions"],
  "calf raise": [
    "standing calf raises",
    "machine standing calf raises",
    "seated calf raises",
  ],
  shrug: ["barbell shrugs", "dumbbell shrugs"],
  crunch: ["crunch floor", "bicycle crunches"],
  "farmers walk": ["farmer's walk"],
  "farmers carry": ["farmer's walk"],
  "farmer carry": ["farmer's walk"],
  "kettlebell swing": ["kettlebell swings"],
  clean: ["power clean", "clean and press"],
};

export const COMMON_ALIASES: Map<string, string[]> = new Map(
  Object.entries(RAW_ALIASES).map(([k, v]) => [normalizeExerciseName(k), v]),
);

// ── Image overrides ──────────────────────────────────────────────────
// Hand-added "famous name" catalog rows (Title Case, e.g. "Push-ups")
// borrowed an ExerciseDB animation when they were created, and some got
// the wrong one ("Push-ups" showed the clock push-up, "Wrist Curls" a
// REVERSE wrist curl). Each entry re-points a curated row at the correct
// ExerciseDB animation id; equipment/target/instructions follow the
// image. Every target id was verified visually against its GIF.
// Keys: the curated row's lowercase name. Value: target animation id, or
// { id, equipment } when the replacement animation's equipment tag
// doesn't describe how people do the exercise (Plank's closest clean
// animation is tagged "weighted"; a plank is a bodyweight move).
export type ImageOverride = string | { id: string; equipment: string };

export const IMAGE_OVERRIDES: Record<string, ImageOverride> = {
  "push-ups": "0662", // push-up            (was: clock push-up)
  "wide push-ups": "1311", // wide hand push up  (was: clock push-up)
  "pull-ups": "0652", // pull-up            (was: assisted close-grip)
  "towel pull-ups": "0652", // pull-up        (no towel variant exists)
  "chin-ups": "1326", // chin-up            (was: neutral-grip variant)
  "wrist curls": "0126", // barbell wrist curl (was: REVERSE wrist curl)
  "lateral raises": "0334", // dumbbell lateral raise (was: cable)
  "front squats": "0042", // barbell front squat (was: bench front squat)
  plank: { id: "2135", equipment: "body weight" }, // front plank (was: with twist)
  "rope pushdowns": "0200", // cable pushdown (with rope) (was: incline)
  "concentration curls": "0297", // dumbbell concentration curl
  "lat pulldown": "0198", // cable pulldown, seated wide grip
  "preacher curls": "0070", // barbell preacher curl (was: lying)
  "russian twists": "0687", // russian twist (was: cable on ball)
  "bicycle crunches": "0003", // air bike = bicycle crunch (was: band)
  "t-bar row": "0606", // lever t bar row (was: reverse t-bar)
  "explosive calf raises": "1372", // barbell standing calf raise (was: seated)
  "hanging knee raises": "0011", // assisted hanging knee raise (closest)
};
