import type { Confidence, MealEstimate } from "@/lib/types";

export interface Food {
  id: string;
  name: string;
  serving: string;
  calories: number;
  protein: number;
  aliases?: string[];
}

/** Rough per-serving estimates. Good enough for a calm daily picture, not a lab result. */
const FOODS: Food[] = [
  { id: "egg", name: "Egg", serving: "1 large", calories: 78, protein: 6, aliases: ["eggs", "boiled egg", "omelette"] },
  { id: "toast", name: "Toast", serving: "1 slice", calories: 80, protein: 3, aliases: ["bread", "slice"] },
  { id: "oats", name: "Oats", serving: "1 bowl", calories: 150, protein: 5, aliases: ["oatmeal", "porridge"] },
  { id: "yogurt", name: "Greek yogurt", serving: "1 cup", calories: 150, protein: 15, aliases: ["yoghurt", "curd", "dahi"] },
  { id: "banana", name: "Banana", serving: "1 medium", calories: 105, protein: 1, aliases: ["bananas"] },
  { id: "apple", name: "Apple", serving: "1 medium", calories: 95, protein: 0, aliases: ["apples"] },
  { id: "berries", name: "Berries", serving: "1 cup", calories: 70, protein: 1, aliases: ["blueberries", "strawberries"] },
  { id: "orange", name: "Orange", serving: "1 medium", calories: 62, protein: 1, aliases: ["oranges"] },
  { id: "rice", name: "Rice", serving: "1 cup cooked", calories: 205, protein: 4, aliases: ["white rice", "brown rice"] },
  { id: "roti", name: "Roti", serving: "1 piece", calories: 110, protein: 3, aliases: ["chapati", "roti", "rotis", "chapatis"] },
  { id: "dal", name: "Dal", serving: "1 bowl", calories: 180, protein: 12, aliases: ["lentils", "daal"] },
  { id: "paneer", name: "Paneer", serving: "100 g", calories: 265, protein: 18 },
  { id: "chicken", name: "Chicken breast", serving: "1 serving", calories: 220, protein: 38, aliases: ["chicken", "grilled chicken"] },
  { id: "fish", name: "Salmon", serving: "1 fillet", calories: 280, protein: 30, aliases: ["fish", "salmon"] },
  { id: "tofu", name: "Tofu", serving: "150 g", calories: 180, protein: 20 },
  { id: "salad", name: "Green salad", serving: "1 bowl", calories: 90, protein: 3, aliases: ["salad"] },
  { id: "veg", name: "Mixed vegetables", serving: "1 cup", calories: 80, protein: 3, aliases: ["vegetables", "veggies", "sabzi"] },
  { id: "pasta", name: "Pasta", serving: "1 plate", calories: 400, protein: 14, aliases: ["spaghetti"] },
  { id: "pizza", name: "Pizza", serving: "1 slice", calories: 285, protein: 12, aliases: ["pizza slice"] },
  { id: "burger", name: "Burger", serving: "1", calories: 520, protein: 26, aliases: ["burgers"] },
  { id: "sandwich", name: "Sandwich", serving: "1", calories: 350, protein: 18, aliases: ["sandwiches", "wrap"] },
  { id: "noodles", name: "Noodles", serving: "1 bowl", calories: 380, protein: 10 },
  { id: "avocado", name: "Avocado", serving: "½ fruit", calories: 120, protein: 1, aliases: ["avocados"] },
  { id: "nuts", name: "Nuts", serving: "1 handful", calories: 170, protein: 6, aliases: ["almonds", "peanuts", "cashews"] },
  { id: "shake", name: "Protein shake", serving: "1 scoop", calories: 160, protein: 30, aliases: ["whey", "protein"] },
  { id: "milk", name: "Milk", serving: "1 glass", calories: 120, protein: 8 },
  { id: "coffee", name: "Coffee", serving: "1 cup", calories: 40, protein: 1, aliases: ["latte", "cappuccino"] },
  { id: "tea", name: "Chai", serving: "1 cup", calories: 70, protein: 2, aliases: ["tea"] },
  { id: "smoothie", name: "Smoothie", serving: "1 glass", calories: 220, protein: 6 },
  { id: "cookie", name: "Cookie", serving: "1", calories: 150, protein: 2, aliases: ["cookies", "biscuit", "biscuits"] },
];

/** Shown first in the quick-add picker. */
export const QUICK_FOODS = ["egg", "oats", "yogurt", "banana", "rice", "dal", "roti", "chicken", "salad", "shake"];

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5,
};

const index = new Map<string, Food>();
for (const food of FOODS) {
  index.set(food.id, food);
  index.set(food.name.toLowerCase(), food);
  for (const alias of food.aliases ?? []) index.set(alias, food);
}

export function foodById(id: string) {
  return FOODS.find((f) => f.id === id);
}

export function searchFoods(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return QUICK_FOODS.map((id) => foodById(id)!).filter(Boolean);
  return FOODS.filter((f) => f.name.toLowerCase().includes(q) || f.aliases?.some((a) => a.includes(q))).slice(0, 10);
}

function lookup(phrase: string): Food | undefined {
  const p = phrase.trim();
  if (index.has(p)) return index.get(p);
  if (p.endsWith("s") && index.has(p.slice(0, -1))) return index.get(p.slice(0, -1));
  // Longest alias contained in the phrase, e.g. "grilled chicken salad" -> chicken
  let best: Food | undefined;
  let bestLen = 0;
  for (const [key, food] of index) {
    if (key.length > bestLen && new RegExp(`\\b${key}\\b`).test(p)) {
      best = food;
      bestLen = key.length;
    }
  }
  return best;
}

export interface ParsedItem {
  food: Food;
  qty: number;
}

/** "I had 2 eggs, toast and a coffee" -> items. Returns [] when nothing recognisable. */
export function parseFoodText(text: string): ParsedItem[] {
  const cleaned = text
    .toLowerCase()
    .replace(/\b(i\s+)?(just\s+)?(ate|had|have|eating|log|logged|for (breakfast|lunch|dinner|snack))\b/g, " ")
    .replace(/[.!?]/g, " ");
  const parts = cleaned.split(/,|\band\b|\bwith\b|\+|&/).map((p) => p.trim()).filter(Boolean);
  const items: ParsedItem[] = [];

  for (const part of parts) {
    const m = part.match(/^(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|half)\s+(?:of\s+)?(.+)$/);
    const qty = m ? Number(m[1]) || NUMBER_WORDS[m[1]] || 1 : 1;
    const food = lookup(m ? m[2] : part);
    if (food) items.push({ food, qty });
  }
  return items;
}

export function estimateFromItems(items: ParsedItem[], confidence: Confidence = "medium"): MealEstimate {
  const label = (i: ParsedItem) => (i.qty === 1 ? i.food.name : `${i.qty} × ${i.food.name}`);
  return {
    name: items.map((i) => i.food.name).slice(0, 3).join(", "),
    items: items.map(label),
    calories: Math.round(items.reduce((sum, i) => sum + i.food.calories * i.qty, 0)),
    protein: Math.round(items.reduce((sum, i) => sum + i.food.protein * i.qty, 0)),
    confidence,
    note: "Estimated from typical portions.",
  };
}

/**
 * Daily targets for a goal, personalised by body weight when given. Rough, general estimates
 * (about 28-33 kcal and 1.0-1.6 g protein per kg), not medical or dietetic advice.
 */
export function targetsFor(goal: string, weightKg?: number) {
  if (!weightKg || weightKg < 30 || weightKg > 250) {
    if (goal === "strength") return { calorieTarget: 2400, proteinTarget: 130 };
    if (goal === "recovery") return { calorieTarget: 2000, proteinTarget: 90 };
    return { calorieTarget: 2100, proteinTarget: 100 };
  }
  const kcalPerKg = goal === "strength" ? 33 : goal === "recovery" ? 28 : 30;
  const proteinPerKg = goal === "strength" ? 1.6 : goal === "recovery" ? 1.0 : 1.2;
  return {
    calorieTarget: Math.min(4000, Math.max(1200, Math.round((weightKg * kcalPerKg) / 50) * 50)),
    proteinTarget: Math.min(250, Math.max(40, Math.round((weightKg * proteinPerKg) / 5) * 5)),
  };
}
