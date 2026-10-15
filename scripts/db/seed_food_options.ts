import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { getSupabaseAdmin, isSupabaseConfigured } from '../../server/supabase.ts';

async function seedFoodOptions() {
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured');
    process.exit(1);
  }
  const client = getSupabaseAdmin();
  if (!client) {
    console.log('Supabase client unavailable');
    process.exit(1);
  }

  const options = [
    // Breakfast
    { id: 'opt-fbf-1', category: 'foodBreakfastItems', label: 'Eggs (Boiled / Fried / Scrambled)', value: 'Eggs', color: 'amber', description: 'Fresh eggs prepared daily', is_active: true, is_system: true, sort_order: 1 },
    { id: 'opt-fbf-2', category: 'foodBreakfastItems', label: 'Bread (White / Brown / Rolls)', value: 'Bread', color: 'amber', description: 'Sliced bread and fresh rolls', is_active: true, is_system: true, sort_order: 2 },
    { id: 'opt-fbf-3', category: 'foodBreakfastItems', label: 'Milk (Whole / Semi-Skimmed)', value: 'Milk', color: 'blue', description: 'Fresh milk for drinks and cereal', is_active: true, is_system: true, sort_order: 3 },
    { id: 'opt-fbf-4', category: 'foodBreakfastItems', label: 'Cereal (Cornflakes / Muesli)', value: 'Cereal', color: 'yellow', description: 'Assorted breakfast cereals', is_active: true, is_system: true, sort_order: 4 },
    { id: 'opt-fbf-5', category: 'foodBreakfastItems', label: 'Cheese (Cheddar Slices)', value: 'Cheese', color: 'amber', description: 'Cheese slices and portions', is_active: true, is_system: true, sort_order: 5 },
    { id: 'opt-fbf-6', category: 'foodBreakfastItems', label: 'Butter / Flora Spread', value: 'Butter', color: 'yellow', description: 'Individual butter and spread portions', is_active: true, is_system: true, sort_order: 6 },
    { id: 'opt-fbf-7', category: 'foodBreakfastItems', label: 'Juice (Orange / Apple)', value: 'Juice', color: 'orange', description: 'Fruit juice cartons', is_active: true, is_system: true, sort_order: 7 },
    { id: 'opt-fbf-8', category: 'foodBreakfastItems', label: 'Jam / Marmalade Portions', value: 'Jam', color: 'rose', description: 'Fruit preserves and jams', is_active: true, is_system: true, sort_order: 8 },
    { id: 'opt-fbf-9', category: 'foodBreakfastItems', label: 'Baked Beans', value: 'Baked Beans', color: 'orange', description: 'Warm baked beans in tomato sauce', is_active: true, is_system: true, sort_order: 9 },
    { id: 'opt-fbf-10', category: 'foodBreakfastItems', label: 'Halal Sausages', value: 'Halal Sausages', color: 'red', description: 'Halal breakfast sausages', is_active: true, is_system: true, sort_order: 10 },
    { id: 'opt-fbf-11', category: 'foodBreakfastItems', label: 'Porridge / Oatmeal', value: 'Porridge', color: 'amber', description: 'Warm porridge oats', is_active: true, is_system: true, sort_order: 11 },
    { id: 'opt-fbf-12', category: 'foodBreakfastItems', label: 'Fresh Fruit (Apples / Bananas)', value: 'Fresh Fruit', color: 'green', description: 'Fresh breakfast fruit', is_active: true, is_system: true, sort_order: 12 },

    // Lunch
    { id: 'opt-flu-1', category: 'foodLunchItems', label: 'Southern fried chicken', value: 'Southern fried chicken', color: 'amber', description: 'Crispy fried chicken portions', is_active: true, is_system: true, sort_order: 1 },
    { id: 'opt-flu-2', category: 'foodLunchItems', label: 'Southern fried tofu', value: 'Southern fried tofu', color: 'emerald', description: 'Vegetarian / vegan tofu alternative', is_active: true, is_system: true, sort_order: 2 },
    { id: 'opt-flu-3', category: 'foodLunchItems', label: 'Fresh Salad & Dressings', value: 'Salad', color: 'green', description: 'Mixed green salad with dressing', is_active: true, is_system: true, sort_order: 3 },
    { id: 'opt-flu-4', category: 'foodLunchItems', label: 'Chips / Potato Wedges', value: 'Chips', color: 'yellow', description: 'Oven baked potato chips', is_active: true, is_system: true, sort_order: 4 },
    { id: 'opt-flu-5', category: 'foodLunchItems', label: 'Pasta Bolognese (Halal)', value: 'Pasta Bolognese', color: 'rose', description: 'Minced beef pasta dish', is_active: true, is_system: true, sort_order: 5 },
    { id: 'opt-flu-6', category: 'foodLunchItems', label: 'Jacket Potatoes with Beans/Cheese', value: 'Jacket Potatoes', color: 'amber', description: 'Baked jacket potatoes with filling', is_active: true, is_system: true, sort_order: 6 },
    { id: 'opt-flu-7', category: 'foodLunchItems', label: 'Sandwiches & Filled Wraps', value: 'Sandwiches & Wraps', color: 'blue', description: 'Cold lunch sandwiches and wraps', is_active: true, is_system: true, sort_order: 7 },
    { id: 'opt-flu-8', category: 'foodLunchItems', label: 'Beef Burger with Salad', value: 'Beef Burger', color: 'red', description: 'Grilled beef patty in bun', is_active: true, is_system: true, sort_order: 8 },
    { id: 'opt-flu-9', category: 'foodLunchItems', label: 'Vegetable Curry with Rice', value: 'Vegetable Curry', color: 'teal', description: 'Mild vegetable curry with basmati rice', is_active: true, is_system: true, sort_order: 9 },
    { id: 'opt-flu-10', category: 'foodLunchItems', label: 'Soup of the Day with Bread Roll', value: 'Soup & Roll', color: 'slate', description: 'Hot seasonal soup with roll', is_active: true, is_system: true, sort_order: 10 },

    // Dinner
    { id: 'opt-fdi-1', category: 'foodDinnerItems', label: 'Beef massaman curry', value: 'Beef massaman curry', color: 'amber', description: 'Tender beef in mild massaman curry', is_active: true, is_system: true, sort_order: 1 },
    { id: 'opt-fdi-2', category: 'foodDinnerItems', label: 'Cauliflower massaman curry', value: 'Cauliflower massaman curry', color: 'emerald', description: 'Vegetarian cauliflower massaman curry', is_active: true, is_system: true, sort_order: 2 },
    { id: 'opt-fdi-3', category: 'foodDinnerItems', label: 'Steamed Basmati Rice', value: 'Rice', color: 'slate', description: 'Long grain steamed rice', is_active: true, is_system: true, sort_order: 3 },
    { id: 'opt-fdi-4', category: 'foodDinnerItems', label: 'Dinner Salad', value: 'Salad', color: 'green', description: 'Fresh mixed dinner salad', is_active: true, is_system: true, sort_order: 4 },
    { id: 'opt-fdi-5', category: 'foodDinnerItems', label: 'Roast Chicken & Gravy', value: 'Roast Chicken', color: 'orange', description: 'Roast halal chicken with roast potatoes & gravy', is_active: true, is_system: true, sort_order: 5 },
    { id: 'opt-fdi-6', category: 'foodDinnerItems', label: 'Vegetable Lasagne', value: 'Vegetable Lasagne', color: 'teal', description: 'Baked Mediterranean vegetable lasagne', is_active: true, is_system: true, sort_order: 6 },
    { id: 'opt-fdi-7', category: 'foodDinnerItems', label: 'Shepherd\'s Pie', value: 'Shepherd\'s Pie', color: 'rose', description: 'Minced lamb with mashed potato topping', is_active: true, is_system: true, sort_order: 7 },
    { id: 'opt-fdi-8', category: 'foodDinnerItems', label: 'Battered Fish & Chips', value: 'Fish & Chips', color: 'blue', description: 'Crispy battered fish fillet with chips and peas', is_active: true, is_system: true, sort_order: 8 },
    { id: 'opt-fdi-9', category: 'foodDinnerItems', label: 'Halal Lamb Stew with Veg', value: 'Halal Lamb Stew', color: 'red', description: 'Slow cooked lamb stew with root vegetables', is_active: true, is_system: true, sort_order: 9 },
    { id: 'opt-fdi-10', category: 'foodDinnerItems', label: 'Vegetable Biryani', value: 'Vegetable Biryani', color: 'amber', description: 'Aromatic spiced basmati rice with mixed vegetables', is_active: true, is_system: true, sort_order: 10 }
  ];

  const { error } = await client.from('field_options').upsert(options, { onConflict: 'id' });
  if (error) {
    console.error('Error seeding field options:', error.message);
  } else {
    console.log(`Successfully upserted ${options.length} food items to Supabase field_options!`);
  }
}

seedFoodOptions();
