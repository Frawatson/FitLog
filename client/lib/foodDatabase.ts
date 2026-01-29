export interface FoodDatabaseItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  category: "protein" | "carbs" | "dairy" | "vegetables" | "fruits" | "fats" | "snacks" | "beverages";
}

export const FOOD_DATABASE: FoodDatabaseItem[] = [
  // Proteins
  { id: "food_1", name: "Chicken Breast", calories: 165, protein: 31, carbs: 0, fat: 4, servingSize: "100g", category: "protein" },
  { id: "food_2", name: "Salmon Fillet", calories: 208, protein: 25, carbs: 0, fat: 12, servingSize: "100g", category: "protein" },
  { id: "food_3", name: "Ground Beef (93% lean)", calories: 164, protein: 23, carbs: 0, fat: 8, servingSize: "100g", category: "protein" },
  { id: "food_4", name: "Turkey Breast", calories: 135, protein: 30, carbs: 0, fat: 1, servingSize: "100g", category: "protein" },
  { id: "food_5", name: "Tuna (canned in water)", calories: 116, protein: 26, carbs: 0, fat: 1, servingSize: "100g", category: "protein" },
  { id: "food_6", name: "Shrimp", calories: 99, protein: 24, carbs: 0, fat: 0, servingSize: "100g", category: "protein" },
  { id: "food_7", name: "Tilapia", calories: 96, protein: 20, carbs: 0, fat: 2, servingSize: "100g", category: "protein" },
  { id: "food_8", name: "Pork Tenderloin", calories: 143, protein: 26, carbs: 0, fat: 4, servingSize: "100g", category: "protein" },
  { id: "food_9", name: "Egg (whole)", calories: 78, protein: 6, carbs: 1, fat: 5, servingSize: "1 large", category: "protein" },
  { id: "food_10", name: "Egg White", calories: 17, protein: 4, carbs: 0, fat: 0, servingSize: "1 large", category: "protein" },
  { id: "food_11", name: "Sirloin Steak", calories: 206, protein: 26, carbs: 0, fat: 11, servingSize: "100g", category: "protein" },
  { id: "food_12", name: "Lamb Chop", calories: 282, protein: 24, carbs: 0, fat: 20, servingSize: "100g", category: "protein" },
  
  // Carbs
  { id: "food_20", name: "White Rice (cooked)", calories: 130, protein: 3, carbs: 28, fat: 0, servingSize: "100g", category: "carbs" },
  { id: "food_21", name: "Brown Rice (cooked)", calories: 112, protein: 3, carbs: 24, fat: 1, servingSize: "100g", category: "carbs" },
  { id: "food_22", name: "Sweet Potato", calories: 86, protein: 2, carbs: 20, fat: 0, servingSize: "100g", category: "carbs" },
  { id: "food_23", name: "Quinoa (cooked)", calories: 120, protein: 4, carbs: 21, fat: 2, servingSize: "100g", category: "carbs" },
  { id: "food_24", name: "Oatmeal (dry)", calories: 389, protein: 17, carbs: 66, fat: 7, servingSize: "100g", category: "carbs" },
  { id: "food_25", name: "Pasta (cooked)", calories: 131, protein: 5, carbs: 25, fat: 1, servingSize: "100g", category: "carbs" },
  { id: "food_26", name: "Bread (whole wheat)", calories: 247, protein: 13, carbs: 41, fat: 4, servingSize: "100g", category: "carbs" },
  { id: "food_27", name: "Potato", calories: 77, protein: 2, carbs: 17, fat: 0, servingSize: "100g", category: "carbs" },
  { id: "food_28", name: "Bagel", calories: 250, protein: 10, carbs: 48, fat: 2, servingSize: "1 medium", category: "carbs" },
  { id: "food_29", name: "Tortilla (flour)", calories: 150, protein: 4, carbs: 26, fat: 4, servingSize: "1 large", category: "carbs" },
  
  // Dairy
  { id: "food_30", name: "Greek Yogurt (plain)", calories: 59, protein: 10, carbs: 4, fat: 0, servingSize: "100g", category: "dairy" },
  { id: "food_31", name: "Cottage Cheese (low fat)", calories: 72, protein: 12, carbs: 3, fat: 1, servingSize: "100g", category: "dairy" },
  { id: "food_32", name: "Milk (2%)", calories: 50, protein: 3, carbs: 5, fat: 2, servingSize: "100ml", category: "dairy" },
  { id: "food_33", name: "Cheddar Cheese", calories: 403, protein: 25, carbs: 1, fat: 33, servingSize: "100g", category: "dairy" },
  { id: "food_34", name: "Mozzarella Cheese", calories: 280, protein: 28, carbs: 3, fat: 17, servingSize: "100g", category: "dairy" },
  { id: "food_35", name: "Whey Protein Powder", calories: 120, protein: 25, carbs: 3, fat: 1, servingSize: "1 scoop (30g)", category: "dairy" },
  { id: "food_36", name: "Casein Protein Powder", calories: 110, protein: 24, carbs: 3, fat: 1, servingSize: "1 scoop (30g)", category: "dairy" },
  
  // Vegetables
  { id: "food_40", name: "Broccoli", calories: 34, protein: 3, carbs: 7, fat: 0, servingSize: "100g", category: "vegetables" },
  { id: "food_41", name: "Spinach", calories: 23, protein: 3, carbs: 4, fat: 0, servingSize: "100g", category: "vegetables" },
  { id: "food_42", name: "Asparagus", calories: 20, protein: 2, carbs: 4, fat: 0, servingSize: "100g", category: "vegetables" },
  { id: "food_43", name: "Green Beans", calories: 31, protein: 2, carbs: 7, fat: 0, servingSize: "100g", category: "vegetables" },
  { id: "food_44", name: "Carrots", calories: 41, protein: 1, carbs: 10, fat: 0, servingSize: "100g", category: "vegetables" },
  { id: "food_45", name: "Bell Pepper", calories: 31, protein: 1, carbs: 6, fat: 0, servingSize: "100g", category: "vegetables" },
  { id: "food_46", name: "Cucumber", calories: 16, protein: 1, carbs: 4, fat: 0, servingSize: "100g", category: "vegetables" },
  { id: "food_47", name: "Tomato", calories: 18, protein: 1, carbs: 4, fat: 0, servingSize: "100g", category: "vegetables" },
  { id: "food_48", name: "Mushrooms", calories: 22, protein: 3, carbs: 3, fat: 0, servingSize: "100g", category: "vegetables" },
  { id: "food_49", name: "Cauliflower", calories: 25, protein: 2, carbs: 5, fat: 0, servingSize: "100g", category: "vegetables" },
  
  // Fruits
  { id: "food_50", name: "Banana", calories: 89, protein: 1, carbs: 23, fat: 0, servingSize: "1 medium", category: "fruits" },
  { id: "food_51", name: "Apple", calories: 95, protein: 0, carbs: 25, fat: 0, servingSize: "1 medium", category: "fruits" },
  { id: "food_52", name: "Blueberries", calories: 57, protein: 1, carbs: 14, fat: 0, servingSize: "100g", category: "fruits" },
  { id: "food_53", name: "Strawberries", calories: 32, protein: 1, carbs: 8, fat: 0, servingSize: "100g", category: "fruits" },
  { id: "food_54", name: "Orange", calories: 62, protein: 1, carbs: 15, fat: 0, servingSize: "1 medium", category: "fruits" },
  { id: "food_55", name: "Grapes", calories: 69, protein: 1, carbs: 18, fat: 0, servingSize: "100g", category: "fruits" },
  { id: "food_56", name: "Watermelon", calories: 30, protein: 1, carbs: 8, fat: 0, servingSize: "100g", category: "fruits" },
  { id: "food_57", name: "Mango", calories: 60, protein: 1, carbs: 15, fat: 0, servingSize: "100g", category: "fruits" },
  { id: "food_58", name: "Pineapple", calories: 50, protein: 1, carbs: 13, fat: 0, servingSize: "100g", category: "fruits" },
  { id: "food_59", name: "Avocado", calories: 160, protein: 2, carbs: 9, fat: 15, servingSize: "100g", category: "fruits" },
  
  // Fats & Nuts
  { id: "food_60", name: "Almonds", calories: 579, protein: 21, carbs: 22, fat: 50, servingSize: "100g", category: "fats" },
  { id: "food_61", name: "Peanut Butter", calories: 588, protein: 25, carbs: 20, fat: 50, servingSize: "100g", category: "fats" },
  { id: "food_62", name: "Olive Oil", calories: 884, protein: 0, carbs: 0, fat: 100, servingSize: "100ml", category: "fats" },
  { id: "food_63", name: "Walnuts", calories: 654, protein: 15, carbs: 14, fat: 65, servingSize: "100g", category: "fats" },
  { id: "food_64", name: "Coconut Oil", calories: 862, protein: 0, carbs: 0, fat: 100, servingSize: "100ml", category: "fats" },
  { id: "food_65", name: "Cashews", calories: 553, protein: 18, carbs: 30, fat: 44, servingSize: "100g", category: "fats" },
  { id: "food_66", name: "Butter", calories: 717, protein: 1, carbs: 0, fat: 81, servingSize: "100g", category: "fats" },
  { id: "food_67", name: "Chia Seeds", calories: 486, protein: 17, carbs: 42, fat: 31, servingSize: "100g", category: "fats" },
  
  // Snacks & Misc
  { id: "food_70", name: "Protein Bar", calories: 200, protein: 20, carbs: 22, fat: 7, servingSize: "1 bar", category: "snacks" },
  { id: "food_71", name: "Rice Cake", calories: 35, protein: 1, carbs: 7, fat: 0, servingSize: "1 cake", category: "snacks" },
  { id: "food_72", name: "Beef Jerky", calories: 116, protein: 9, carbs: 3, fat: 7, servingSize: "30g", category: "snacks" },
  { id: "food_73", name: "Trail Mix", calories: 462, protein: 12, carbs: 45, fat: 29, servingSize: "100g", category: "snacks" },
  { id: "food_74", name: "Granola", calories: 489, protein: 15, carbs: 64, fat: 20, servingSize: "100g", category: "snacks" },
  { id: "food_75", name: "Dark Chocolate (70%)", calories: 598, protein: 8, carbs: 46, fat: 43, servingSize: "100g", category: "snacks" },
  { id: "food_76", name: "Hummus", calories: 166, protein: 8, carbs: 14, fat: 10, servingSize: "100g", category: "snacks" },
  
  // Beverages
  { id: "food_80", name: "Black Coffee", calories: 2, protein: 0, carbs: 0, fat: 0, servingSize: "240ml", category: "beverages" },
  { id: "food_81", name: "Green Tea", calories: 0, protein: 0, carbs: 0, fat: 0, servingSize: "240ml", category: "beverages" },
  { id: "food_82", name: "Orange Juice", calories: 112, protein: 2, carbs: 26, fat: 0, servingSize: "240ml", category: "beverages" },
  { id: "food_83", name: "Almond Milk (unsweetened)", calories: 17, protein: 1, carbs: 0, fat: 1, servingSize: "240ml", category: "beverages" },
  { id: "food_84", name: "Coconut Water", calories: 46, protein: 2, carbs: 9, fat: 0, servingSize: "240ml", category: "beverages" },
  { id: "food_85", name: "Sports Drink", calories: 80, protein: 0, carbs: 21, fat: 0, servingSize: "355ml", category: "beverages" },
];

export function searchFoods(query: string): FoodDatabaseItem[] {
  const searchTerm = query.toLowerCase().trim();
  if (!searchTerm) return [];
  
  return FOOD_DATABASE.filter((food) =>
    food.name.toLowerCase().includes(searchTerm)
  ).slice(0, 10);
}

export function getFoodsByCategory(category: string): FoodDatabaseItem[] {
  return FOOD_DATABASE.filter((food) => food.category === category);
}

export function getAllFoods(): FoodDatabaseItem[] {
  return FOOD_DATABASE;
}
