type MinMedianMax = { min: number; median: number; max: number };
type Mode = "lean" | "maintenance" | "bulk";

interface CallAItem {
  name: string;
  category: string;
  grams: MinMedianMax;
  bone_in: boolean;
  fried_breaded: boolean;
  pan_seared: boolean;
  oil_present: boolean;
  sauce_type: "none" | "bbq" | "mayo_ranch" | "ketchup" | "hot_sauce" | "unknown";
  sauce_tbsp: MinMedianMax;
}

interface MacroEntry {
  kcal: number;
  p: number;
  c: number;
  f: number;
  per: "100g" | "1tbsp";
}

const MACRO_TABLE: Record<string, MacroEntry> = {
  chicken_breast_grilled: { kcal: 165, p: 31, c: 0, f: 4, per: "100g" },
  chicken_breast_pan_seared: { kcal: 190, p: 30, c: 0, f: 8, per: "100g" },
  chicken_thigh: { kcal: 215, p: 24, c: 0, f: 13, per: "100g" },
  chicken_fried_breaded: { kcal: 280, p: 23, c: 16, f: 16, per: "100g" },
  ground_beef_lean: { kcal: 200, p: 26, c: 0, f: 10, per: "100g" },
  ground_beef_regular: { kcal: 254, p: 26, c: 0, f: 16, per: "100g" },
  steak_lean: { kcal: 200, p: 27, c: 0, f: 10, per: "100g" },
  steak_moderate: { kcal: 250, p: 26, c: 0, f: 16, per: "100g" },
  steak_fatty: { kcal: 310, p: 24, c: 0, f: 24, per: "100g" },
  pork_chop_lean: { kcal: 200, p: 27, c: 0, f: 9, per: "100g" },
  pork_chop_moderate: { kcal: 250, p: 26, c: 0, f: 17, per: "100g" },
  pork_chop_fatty: { kcal: 310, p: 23, c: 0, f: 25, per: "100g" },
  salmon: { kcal: 208, p: 22, c: 0, f: 13, per: "100g" },
  white_fish: { kcal: 120, p: 24, c: 0, f: 2, per: "100g" },
  tilapia: { kcal: 128, p: 26, c: 0, f: 3, per: "100g" },
  tuna: { kcal: 132, p: 29, c: 0, f: 1, per: "100g" },
  turkey_breast: { kcal: 135, p: 29, c: 0, f: 2, per: "100g" },
  ground_turkey_lean: { kcal: 170, p: 24, c: 0, f: 8, per: "100g" },
  ground_turkey_regular: { kcal: 220, p: 23, c: 0, f: 14, per: "100g" },
  shrimp: { kcal: 100, p: 24, c: 0, f: 1, per: "100g" },
  egg_whole: { kcal: 143, p: 13, c: 1, f: 10, per: "100g" },
  egg_whites: { kcal: 52, p: 11, c: 1, f: 0, per: "100g" },
  tofu: { kcal: 90, p: 10, c: 2, f: 5, per: "100g" },
  tempeh: { kcal: 190, p: 19, c: 9, f: 11, per: "100g" },
  greek_yogurt_plain: { kcal: 60, p: 10, c: 4, f: 0, per: "100g" },
  greek_yogurt_flavored: { kcal: 95, p: 9, c: 12, f: 1, per: "100g" },
  cottage_cheese: { kcal: 98, p: 11, c: 3, f: 4, per: "100g" },
  beef_jerky: { kcal: 300, p: 40, c: 10, f: 8, per: "100g" },
  protein_bar: { kcal: 360, p: 25, c: 35, f: 10, per: "100g" },
  protein_powder: { kcal: 400, p: 80, c: 10, f: 6, per: "100g" },
  ham: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },
  bacon: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },
  sausage: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },
  lamb: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },
  venison: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },
  crab: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },
  lobster: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },
  sardines: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },
  mackerel: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },
  whey_shake_ready_to_drink: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },
  casein_shake: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },
  edamame: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },
  beans_chili: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },
  chicken_sausage: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },
  turkey_bacon: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },
  deli_chicken: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },
  deli_turkey: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },
  ground_bison: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },
  bison_steak: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },
  pork_tenderloin: { kcal: 200, p: 25, c: 0, f: 10, per: "100g" },

  white_rice: { kcal: 130, p: 2.7, c: 28, f: 0.3, per: "100g" },
  brown_rice: { kcal: 112, p: 2.3, c: 23, f: 0.9, per: "100g" },
  jasmine_rice: { kcal: 130, p: 2.7, c: 28, f: 0.3, per: "100g" },
  basmati_rice: { kcal: 125, p: 2.6, c: 27, f: 0.3, per: "100g" },
  rice_mix: { kcal: 130, p: 3, c: 28, f: 1, per: "100g" },
  sweet_potato: { kcal: 90, p: 2, c: 21, f: 0.1, per: "100g" },
  white_potato: { kcal: 87, p: 2, c: 20, f: 0.1, per: "100g" },
  mashed_potatoes: { kcal: 110, p: 2, c: 17, f: 4, per: "100g" },
  baked_potato: { kcal: 93, p: 2.5, c: 21, f: 0.1, per: "100g" },
  fries_fried: { kcal: 320, p: 3.5, c: 41, f: 15, per: "100g" },
  oats_cooked: { kcal: 70, p: 2.5, c: 12, f: 1.5, per: "100g" },
  oats_overnight: { kcal: 70, p: 2.5, c: 12, f: 1.5, per: "100g" },
  pasta_cooked: { kcal: 131, p: 5, c: 25, f: 1.1, per: "100g" },
  quinoa: { kcal: 120, p: 4, c: 21, f: 2, per: "100g" },
  couscous: { kcal: 130, p: 3, c: 28, f: 1, per: "100g" },
  black_beans: { kcal: 132, p: 9, c: 24, f: 0.5, per: "100g" },
  kidney_beans: { kcal: 132, p: 9, c: 24, f: 0.5, per: "100g" },
  lentils: { kcal: 116, p: 9, c: 20, f: 0.4, per: "100g" },
  chickpeas: { kcal: 132, p: 9, c: 24, f: 0.5, per: "100g" },
  tortilla_flour: { kcal: 300, p: 8, c: 50, f: 8, per: "100g" },
  tortilla_corn: { kcal: 300, p: 8, c: 50, f: 8, per: "100g" },
  bagel_plain: { kcal: 265, p: 9, c: 49, f: 3.2, per: "100g" },
  bread_white: { kcal: 265, p: 9, c: 49, f: 3.2, per: "100g" },
  bread_wheat: { kcal: 250, p: 9, c: 43, f: 4, per: "100g" },
  wrap_flatbread: { kcal: 300, p: 8, c: 50, f: 8, per: "100g" },
  burger_bun: { kcal: 270, p: 9, c: 50, f: 4, per: "100g" },
  english_muffin: { kcal: 265, p: 9, c: 49, f: 3.2, per: "100g" },
  pancakes: { kcal: 130, p: 3, c: 28, f: 1, per: "100g" },
  waffles: { kcal: 130, p: 3, c: 28, f: 1, per: "100g" },
  cereal: { kcal: 130, p: 3, c: 28, f: 1, per: "100g" },
  granola: { kcal: 130, p: 3, c: 28, f: 1, per: "100g" },
  rice_cakes: { kcal: 387, p: 8, c: 82, f: 3, per: "100g" },
  banana: { kcal: 89, p: 1.1, c: 23, f: 0.3, per: "100g" },
  apple: { kcal: 60, p: 0.8, c: 15, f: 0.2, per: "100g" },
  berries: { kcal: 50, p: 1, c: 12, f: 0.3, per: "100g" },
  grapes: { kcal: 60, p: 0.8, c: 15, f: 0.2, per: "100g" },
  orange: { kcal: 60, p: 0.8, c: 15, f: 0.2, per: "100g" },
  mango: { kcal: 60, p: 0.8, c: 15, f: 0.2, per: "100g" },
  pineapple: { kcal: 60, p: 0.8, c: 15, f: 0.2, per: "100g" },
  mixed_fruit: { kcal: 60, p: 0.8, c: 15, f: 0.2, per: "100g" },
  yogurt_parfait: { kcal: 130, p: 3, c: 28, f: 1, per: "100g" },
  protein_cookie: { kcal: 130, p: 3, c: 28, f: 1, per: "100g" },
  pretzels: { kcal: 130, p: 3, c: 28, f: 1, per: "100g" },
  popcorn: { kcal: 130, p: 3, c: 28, f: 1, per: "100g" },
  crackers: { kcal: 130, p: 3, c: 28, f: 1, per: "100g" },
  ramen_noodles: { kcal: 131, p: 5, c: 25, f: 1.1, per: "100g" },
  udon_noodles: { kcal: 131, p: 5, c: 25, f: 1.1, per: "100g" },
  sushi_rice: { kcal: 130, p: 2.7, c: 28, f: 0.3, per: "100g" },
  honey: { kcal: 130, p: 3, c: 28, f: 1, per: "100g" },
  jam_jelly: { kcal: 130, p: 3, c: 28, f: 1, per: "100g" },
  dates: { kcal: 130, p: 3, c: 28, f: 1, per: "100g" },

  broccoli: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  green_beans: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  asparagus: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  spinach: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  kale: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  mixed_vegetables: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  salad_plain: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  carrots: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  zucchini: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  brussels_sprouts: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  cauliflower: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  cabbage: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  bell_peppers: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  onions: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  mushrooms: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  tomatoes: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  cucumber: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  lettuce: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  arugula: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  bok_choy: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  broccolini: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  snap_peas: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  peas: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  corn: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  sweet_corn: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  eggplant: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  okra: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  beets: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  celery: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  radish: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  sauerkraut: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  pickles: { kcal: 15, p: 0.5, c: 3, f: 0, per: "100g" },
  jalapenos: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  garlic: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  ginger: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  spring_mix: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  coleslaw_plain: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  coleslaw_creamy: { kcal: 150, p: 1, c: 14, f: 10, per: "100g" },
  salsa: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  pico_de_gallo: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  kimchi: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  seaweed_salad: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  edamame_side: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  butternut_squash: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  pumpkin: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  parsnips: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  turnips: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  artichoke: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  leeks: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  fajita_veggies: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },
  stir_fry_veggies: { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" },

  olive_oil: { kcal: 120, p: 0, c: 0, f: 14, per: "1tbsp" },
  avocado_oil: { kcal: 120, p: 0, c: 0, f: 14, per: "1tbsp" },
  butter: { kcal: 100, p: 0, c: 0, f: 11, per: "1tbsp" },
  ghee: { kcal: 120, p: 0, c: 0, f: 14, per: "1tbsp" },
  cheese_generic: { kcal: 400, p: 25, c: 1, f: 33, per: "100g" },
  cheddar_cheese: { kcal: 400, p: 25, c: 1, f: 33, per: "100g" },
  mozzarella: { kcal: 280, p: 28, c: 3, f: 17, per: "100g" },
  parmesan: { kcal: 431, p: 38, c: 4, f: 29, per: "100g" },
  cream_cheese: { kcal: 342, p: 6, c: 4, f: 34, per: "100g" },
  sour_cream: { kcal: 193, p: 2, c: 5, f: 19, per: "100g" },
  peanut_butter: { kcal: 588, p: 25, c: 20, f: 50, per: "100g" },
  almond_butter: { kcal: 614, p: 21, c: 19, f: 56, per: "100g" },
  nuts_mixed: { kcal: 607, p: 20, c: 21, f: 54, per: "100g" },
  walnuts: { kcal: 654, p: 15, c: 14, f: 65, per: "100g" },
  almonds: { kcal: 579, p: 21, c: 22, f: 50, per: "100g" },
  cashews: { kcal: 553, p: 18, c: 30, f: 44, per: "100g" },
  trail_mix: { kcal: 462, p: 13, c: 45, f: 29, per: "100g" },
  avocado: { kcal: 160, p: 2, c: 9, f: 15, per: "100g" },
  guacamole: { kcal: 160, p: 2, c: 9, f: 15, per: "100g" },
  pesto: { kcal: 375, p: 5, c: 6, f: 37, per: "100g" },
  hummus: { kcal: 166, p: 8, c: 14, f: 10, per: "100g" },
  tahini: { kcal: 595, p: 17, c: 21, f: 54, per: "100g" },
  olive_tapenade: { kcal: 375, p: 5, c: 6, f: 37, per: "100g" },
  coconut_oil: { kcal: 120, p: 0, c: 0, f: 14, per: "1tbsp" },
  sesame_oil: { kcal: 120, p: 0, c: 0, f: 14, per: "1tbsp" },
  vinaigrette: { kcal: 70, p: 0, c: 2, f: 7, per: "1tbsp" },
  italian_dressing: { kcal: 70, p: 0, c: 2, f: 7, per: "1tbsp" },
  caesar_dressing: { kcal: 100, p: 0, c: 1, f: 11, per: "1tbsp" },
  blue_cheese_dressing: { kcal: 100, p: 0, c: 1, f: 11, per: "1tbsp" },
  honey_mustard: { kcal: 70, p: 0, c: 6, f: 5, per: "1tbsp" },
  buffalo_sauce: { kcal: 10, p: 0, c: 1, f: 0.5, per: "1tbsp" },
  gravy: { kcal: 40, p: 1, c: 3, f: 3, per: "1tbsp" },
  cheese_sauce: { kcal: 50, p: 2, c: 2, f: 4, per: "1tbsp" },
  chili_oil: { kcal: 120, p: 0, c: 0, f: 14, per: "1tbsp" },
  maple_syrup: { kcal: 52, p: 0, c: 13, f: 0, per: "1tbsp" },
  chocolate_sauce: { kcal: 50, p: 0.5, c: 12, f: 0.5, per: "1tbsp" },
  ice_cream: { kcal: 207, p: 4, c: 24, f: 11, per: "100g" },
  whipped_cream: { kcal: 250, p: 3, c: 13, f: 22, per: "100g" },
  bacon_bits: { kcal: 500, p: 30, c: 5, f: 40, per: "100g" },
  croutons: { kcal: 407, p: 10, c: 63, f: 13, per: "100g" },
  butter_sauce: { kcal: 100, p: 0, c: 0, f: 11, per: "1tbsp" },
  garlic_butter: { kcal: 100, p: 0, c: 0, f: 11, per: "1tbsp" },

  bbq_sauce: { kcal: 40, p: 0, c: 10, f: 0, per: "1tbsp" },
  ketchup: { kcal: 20, p: 0, c: 5, f: 0, per: "1tbsp" },
  mayo: { kcal: 100, p: 0, c: 1, f: 11, per: "1tbsp" },
  ranch: { kcal: 100, p: 0, c: 1, f: 11, per: "1tbsp" },
  aioli: { kcal: 100, p: 0, c: 1, f: 11, per: "1tbsp" },
  hot_sauce: { kcal: 5, p: 0, c: 1, f: 0, per: "1tbsp" },
  mustard: { kcal: 10, p: 0, c: 1, f: 0.5, per: "1tbsp" },
  soy_sauce: { kcal: 10, p: 1, c: 1, f: 0, per: "1tbsp" },
  teriyaki_sauce: { kcal: 30, p: 1, c: 6, f: 0, per: "1tbsp" },
  sriracha: { kcal: 10, p: 0, c: 2, f: 0, per: "1tbsp" },
};

const SAUCE_MACRO_MAP: Record<string, MacroEntry> = {
  bbq: { kcal: 40, p: 0, c: 10, f: 0, per: "1tbsp" },
  ketchup: { kcal: 20, p: 0, c: 5, f: 0, per: "1tbsp" },
  hot_sauce: { kcal: 5, p: 0, c: 1, f: 0, per: "1tbsp" },
  mayo_ranch: { kcal: 100, p: 0, c: 1, f: 11, per: "1tbsp" },
  unknown: { kcal: 100, p: 0, c: 1, f: 11, per: "1tbsp" },
};

const OIL_PER_TBSP: MacroEntry = { kcal: 120, p: 0, c: 0, f: 14, per: "1tbsp" };

const DEFAULT_PROTEIN: MacroEntry = { kcal: 200, p: 25, c: 0, f: 10, per: "100g" };
const DEFAULT_CARB: MacroEntry = { kcal: 130, p: 3, c: 28, f: 1, per: "100g" };
const DEFAULT_VEG: MacroEntry = { kcal: 35, p: 2, c: 7, f: 0.3, per: "100g" };

const PROTEIN_CATEGORIES = new Set([
  "chicken_breast_grilled", "chicken_breast_pan_seared", "chicken_thigh", "chicken_fried_breaded",
  "ground_beef_lean", "ground_beef_regular", "steak_lean", "steak_moderate", "steak_fatty",
  "pork_chop_lean", "pork_chop_moderate", "pork_chop_fatty", "salmon", "white_fish", "tilapia",
  "tuna", "turkey_breast", "ground_turkey_lean", "ground_turkey_regular", "shrimp",
  "egg_whole", "egg_whites", "tofu", "tempeh", "greek_yogurt_plain", "greek_yogurt_flavored",
  "cottage_cheese", "beef_jerky", "protein_bar", "protein_powder",
  "ham", "bacon", "sausage", "lamb", "venison", "crab", "lobster", "sardines", "mackerel",
  "whey_shake_ready_to_drink", "casein_shake", "edamame", "beans_chili",
  "chicken_sausage", "turkey_bacon", "deli_chicken", "deli_turkey",
  "ground_bison", "bison_steak", "pork_tenderloin",
]);

const LEANNESS_SHIFT: Record<string, Record<string, string>> = {
  lean: {
    steak_fatty: "steak_moderate",
    steak_moderate: "steak_lean",
    pork_chop_fatty: "pork_chop_moderate",
    pork_chop_moderate: "pork_chop_lean",
    ground_beef_regular: "ground_beef_lean",
    ground_turkey_regular: "ground_turkey_lean",
  },
  bulk: {
    steak_lean: "steak_moderate",
    steak_moderate: "steak_fatty",
    pork_chop_lean: "pork_chop_moderate",
    pork_chop_moderate: "pork_chop_fatty",
    ground_beef_lean: "ground_beef_regular",
    ground_turkey_lean: "ground_turkey_regular",
  },
};

const PAN_SEARED_OIL_TBSP: Record<Mode, MinMedianMax> = {
  lean: { min: 0, median: 0.5, max: 1.0 },
  maintenance: { min: 0, median: 1.0, max: 1.5 },
  bulk: { min: 0.5, median: 1.5, max: 2.0 },
};

const PORTION_BIAS: Record<Mode, number> = {
  lean: 0.95,
  maintenance: 1.00,
  bulk: 1.05,
};

const SAUCE_BIAS: Record<Mode, number> = {
  lean: 0.80,
  maintenance: 1.00,
  bulk: 1.20,
};

function getCategoryGroup(category: string): "protein" | "carb" | "vegetable" | "fat" {
  if (PROTEIN_CATEGORIES.has(category)) return "protein";
  if (MACRO_TABLE[category]?.per === "1tbsp") return "fat";
  if (category.includes("coleslaw") || category.includes("pickle") ||
      category.includes("broccoli") || category.includes("green_bean") ||
      category.includes("spinach") || category.includes("kale") ||
      category.includes("salad") || category.includes("carrot") ||
      category.includes("veggie") || category.includes("lettuce") ||
      category.includes("tomato") || category.includes("cucumber") ||
      category.includes("mushroom") || category.includes("pepper") ||
      category.includes("onion") || category.includes("squash") ||
      category.includes("cauliflower") || category.includes("cabbage") ||
      category.includes("asparagus") || category.includes("celery") ||
      category.includes("corn") || category.includes("pea") ||
      category.includes("eggplant") || category.includes("okra") ||
      category.includes("beet") || category.includes("radish") ||
      category.includes("kimchi") || category.includes("seaweed") ||
      category.includes("edamame_side") || category.includes("artichoke") ||
      category.includes("leek") || category.includes("turnip") ||
      category.includes("parsnip") || category.includes("pumpkin") ||
      category.includes("garlic") || category.includes("ginger") ||
      category.includes("jalapeno") || category.includes("sauerkraut") ||
      category.includes("salsa") || category.includes("pico") ||
      category.includes("spring_mix") || category.includes("arugula") ||
      category.includes("bok_choy") || category.includes("broccolini") ||
      category.includes("fajita") || category.includes("stir_fry") ||
      category.includes("zucchini") || category.includes("brussels")) {
    return "vegetable";
  }
  return "carb";
}

function getDefaultMacro(category: string): MacroEntry {
  const group = getCategoryGroup(category);
  if (group === "protein") return DEFAULT_PROTEIN;
  if (group === "vegetable") return DEFAULT_VEG;
  return DEFAULT_CARB;
}

function lookupMacro(category: string, mode: Mode): MacroEntry {
  let cat = category;
  if (LEANNESS_SHIFT[mode]?.[cat]) {
    cat = LEANNESS_SHIFT[mode][cat];
  }
  return MACRO_TABLE[cat] || getDefaultMacro(category);
}

interface CalcResult {
  name: string;
  category_used: string;
  kcal: MinMedianMax;
  p: MinMedianMax;
  c: MinMedianMax;
  f: MinMedianMax;
}

export function calculateMacros(items: CallAItem[], mode: Mode) {
  const warnings: string[] = [];
  const results: CalcResult[] = [];

  for (const item of items) {
    const macro = lookupMacro(item.category, mode);
    const portionBias = PORTION_BIAS[mode];

    let gramsMin = item.grams.min;
    let gramsMedian = item.grams.median * portionBias;
    let gramsMax = item.grams.max;

    if (item.bone_in) {
      gramsMin *= 0.70;
      gramsMedian *= 0.70;
      gramsMax *= 0.70;
    }

    let pMin = 0, pMedian = 0, pMax = 0;
    let cMin = 0, cMedian = 0, cMax = 0;
    let fMin = 0, fMedian = 0, fMax = 0;
    let kcalMin = 0, kcalMedian = 0, kcalMax = 0;

    if (macro.per === "100g") {
      const scale = (g: number) => g / 100;
      pMin = macro.p * scale(gramsMin);
      pMedian = macro.p * scale(gramsMedian);
      pMax = macro.p * scale(gramsMax);
      cMin = macro.c * scale(gramsMin);
      cMedian = macro.c * scale(gramsMedian);
      cMax = macro.c * scale(gramsMax);
      fMin = macro.f * scale(gramsMin);
      fMedian = macro.f * scale(gramsMedian);
      fMax = macro.f * scale(gramsMax);
    } else {
      pMin = macro.p * gramsMin;
      pMedian = macro.p * gramsMedian;
      pMax = macro.p * gramsMax;
      cMin = macro.c * gramsMin;
      cMedian = macro.c * gramsMedian;
      cMax = macro.c * gramsMax;
      fMin = macro.f * gramsMin;
      fMedian = macro.f * gramsMedian;
      fMax = macro.f * gramsMax;
    }

    if (item.pan_seared && !item.fried_breaded) {
      const oilTbsp = PAN_SEARED_OIL_TBSP[mode];
      fMin += OIL_PER_TBSP.f * oilTbsp.min;
      fMedian += OIL_PER_TBSP.f * oilTbsp.median;
      fMax += OIL_PER_TBSP.f * oilTbsp.max;
    }

    if (item.sauce_type && item.sauce_type !== "none" && item.sauce_tbsp) {
      const sauceMacro = SAUCE_MACRO_MAP[item.sauce_type] || SAUCE_MACRO_MAP.unknown;
      const sauceBias = SAUCE_BIAS[mode];

      const sMin = item.sauce_tbsp.min;
      const sMedian = item.sauce_tbsp.median * sauceBias;
      const sMax = item.sauce_tbsp.max;

      pMin += sauceMacro.p * sMin;
      pMedian += sauceMacro.p * sMedian;
      pMax += sauceMacro.p * sMax;
      cMin += sauceMacro.c * sMin;
      cMedian += sauceMacro.c * sMedian;
      cMax += sauceMacro.c * sMax;
      fMin += sauceMacro.f * sMin;
      fMedian += sauceMacro.f * sMedian;
      fMax += sauceMacro.f * sMax;
    }

    kcalMin = pMin * 4 + cMin * 4 + fMin * 9;
    kcalMedian = pMedian * 4 + cMedian * 4 + fMedian * 9;
    kcalMax = pMax * 4 + cMax * 4 + fMax * 9;

    results.push({
      name: item.name,
      category_used: item.category,
      kcal: { min: round(kcalMin), median: round(kcalMedian), max: round(kcalMax) },
      p: { min: round(pMin), median: round(pMedian), max: round(pMax) },
      c: { min: round(cMin), median: round(cMedian), max: round(cMax) },
      f: { min: round(fMin), median: round(fMedian), max: round(fMax) },
    });
  }

  const totals = {
    kcal: { min: 0, median: 0, max: 0 },
    p: { min: 0, median: 0, max: 0 },
    c: { min: 0, median: 0, max: 0 },
    f: { min: 0, median: 0, max: 0 },
  };

  for (const r of results) {
    totals.kcal.min += r.kcal.min;
    totals.kcal.median += r.kcal.median;
    totals.kcal.max += r.kcal.max;
    totals.p.min += r.p.min;
    totals.p.median += r.p.median;
    totals.p.max += r.p.max;
    totals.c.min += r.c.min;
    totals.c.median += r.c.median;
    totals.c.max += r.c.max;
    totals.f.min += r.f.min;
    totals.f.median += r.f.median;
    totals.f.max += r.f.max;
  }

  totals.kcal.min = round(totals.kcal.min);
  totals.kcal.median = round(totals.kcal.median);
  totals.kcal.max = round(totals.kcal.max);
  totals.p.min = round(totals.p.min);
  totals.p.median = round(totals.p.median);
  totals.p.max = round(totals.p.max);
  totals.c.min = round(totals.c.min);
  totals.c.median = round(totals.c.median);
  totals.c.max = round(totals.c.max);
  totals.f.min = round(totals.f.min);
  totals.f.median = round(totals.f.median);
  totals.f.max = round(totals.f.max);

  return {
    mode,
    items: results,
    totals,
    confidence: 1,
    warnings,
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
