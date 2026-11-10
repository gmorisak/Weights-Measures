#!/usr/bin/env python3
import json
import re
import os
import openpyxl
import pypdf

RESOURCES_DIR = "/Users/gmorisak/Library/CloudStorage/OneDrive-Cisco/Documents/Personal/Personal Resources"
EXCEL_PATH = os.path.join(RESOURCES_DIR, "LA Times Weight Chart.xlsx")
PDF_PATH = os.path.join(RESOURCES_DIR, "Ingredient Weight Chart _ King Arthur Baking.pdf")
OUTPUT_JSON = "/Users/gmorisak/Documents/GitHub/Weights & Measures/data/baking_data.json"
OUTPUT_JS = "/Users/gmorisak/Documents/GitHub/Weights & Measures/data/baking_data.js"

CATEGORY_MAP = {
    'Grain': 'Grains & Flours',
    'Sugar': 'Sugars & Sweeteners',
    'Fat': 'Fats & Oils',
    'Dairy': 'Dairy & Eggs',
    'Seeds': 'Nuts & Seeds',
    'Nuts': 'Nuts & Seeds',
    'Chocolate': 'Chocolate & Cocoa',
    'Fruit': 'Fruits & Vegetables',
    'Dried Fruit': 'Fruits & Vegetables',
    'Vegetables': 'Fruits & Vegetables',
    'Liquid': 'Liquids & Syrups'
}

EXPLICIT_SYNONYMS = {
    'granulated sugar': 'Sugar (granulated white)',
    'packed brown sugar': 'Brown sugar (dark or light, packed)',
    'confectioners\' sugar': 'Confectioners\' sugar (unsifted)',
    'turbinado sugar': 'Turbinado sugar (raw)',
    'coconut palm sugar': 'Coconut sugar',
    'demerrara sugar': 'Demerara sugar',
    'unsweetened cocoa powder': 'Cocoa (dry baking)',
    'cocoa powder': 'Cocoa (dry baking)',
    'cocoa': 'Cocoa (dry baking)',
    'dutch cocoa powder': 'Dutch-Process Cocoa',
    'all-purpose flour': 'All-Purpose Flour',
    'whole wheat flour': 'Whole Wheat Flour (Premium 100%)',
    'whole-wheat pastry': 'Whole Wheat Pastry Flour / Graham Flour',
    'bread flour': 'Unbleached Bread Flour',
    'pastry flour': 'Pastry Flour',
    'rye flour': 'Medium Rye Flour',
    'butter': 'Butter',
    'kosher salt': 'Salt (kosher, Diamond Crystal)',
    'table salt': 'Salt (table)',
    'rolled oats': 'Rolled oats',
    'quick oats': 'Quick cooking rolled oats',
    'heavy cream': 'Cream (heavy cream, light cream, or half & half)',
    'ricotta': 'Cheese (Ricotta)',
    'tahini': 'Tahini paste',
    'semolina flour': 'Semolina Flour',
    'baking soda': 'Baking soda',
    'baking powder': 'Baking powder',
    'water': 'Water',
    'honey': 'Honey',
    'molasses': 'Molasses',
    'maple syrup': 'Maple syrup',
    'olive oil': 'Olive oil',
    'vegetable oil': 'Vegetable oil',
    'canola oil': 'Vegetable oil',
    'cornstarch': 'Cornstarch',
    'sour cream': 'Sour cream',
    'cream cheese': 'Cream cheese'
}

def clean_name(name):
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def parse_fraction(s):
    s = s.strip()
    if not s:
        return 0.0
    if '-' in s or ' to ' in s:
        parts = re.split(r'-|\sto\s', s)
        vals = [parse_fraction(p) for p in parts if p.strip()]
        return sum(vals) / len(vals) if vals else 0.0
    parts = s.split()
    total = 0.0
    for p in parts:
        if '/' in p:
            num, den = p.split('/')
            total += float(num) / float(den)
        else:
            try:
                total += float(p)
            except ValueError:
                pass
    return total

def parse_volume_to_cups(vol_str):
    vol_str = vol_str.lower().strip()
    paren = re.search(r'\((.*?)\)', vol_str)
    if paren:
        inner = paren.group(1)
        if 'cup' in inner:
            m = re.search(r'([\d\s/.]+)\s*cup', inner)
            if m:
                return parse_fraction(m.group(1))
    
    if 'cup' in vol_str:
        m = re.search(r'([\d\s/.]+)\s*cup', vol_str)
        if m:
            return parse_fraction(m.group(1))
    elif 'table' in vol_str or 'tbsp' in vol_str:
        m = re.search(r'([\d\s/.]+)\s*(?:table\s*spoons?|tbsp)', vol_str)
        if m:
            tbsp = parse_fraction(m.group(1))
            return tbsp / 16.0
    elif 'tea' in vol_str or 'tsp' in vol_str:
        m = re.search(r'([\d\s/.]+)\s*(?:tea\s*spoons?|tsp)', vol_str)
        if m:
            tsp = parse_fraction(m.group(1))
            return tsp / 48.0
    elif 'stick' in vol_str:
        m = re.search(r'([\d\s/.]+)\s*stick', vol_str)
        if m:
            sticks = parse_fraction(m.group(1))
            return sticks * 0.5
    return None

def normalize_key(name):
    k = name.lower()
    k = re.sub(r'\(.*?\)', '', k)
    k = re.sub(r'[^a-z0-9]', '', k)
    return k

def infer_category(name, default='Specialty & Other'):
    n = name.lower()
    if any(w in n for w in ['flour', 'meal', 'grain', 'oat', 'bran', 'wheat', 'rye', 'barley', 'cornmeal', 'starch', 'semolina', 'tapioca', 'farina', 'millet', 'quinoa', 'rice flour', 'spelt', 'sorghum', 'bread mix', 'baking mix', 'crust', 'crumb']):
        return 'Grains & Flours'
    if any(w in n for w in ['sugar', 'syrup', 'honey', 'molasses', 'agave', 'sweetener', 'sucrose', 'glucose', 'nectar', 'splenda']):
        return 'Sugars & Sweeteners'
    if any(w in n for w in ['butter', 'oil', 'shortening', 'lard', 'margarine', 'ghee']):
        return 'Fats & Oils'
    if any(w in n for w in ['milk', 'cream', 'yogurt', 'cheese', 'buttermilk', 'egg', 'ricotta', 'mascarpone', 'sour cream']):
        return 'Dairy & Eggs'
    if any(w in n for w in ['baking powder', 'baking soda', 'yeast', 'salt', 'cinnamon', 'spice', 'powder', 'flavor', 'extract', 'vanilla', 'espresso powder', 'cardamom', 'ginger', 'nutmeg', 'allspice', 'clove', 'zest', 'dough improver']):
        return 'Leaveners & Spices'
    if any(w in n for w in ['almond', 'walnut', 'pecan', 'seed', 'peanut', 'cashew', 'hazelnut', 'pistachio', 'chia', 'sesame', 'flax', 'poppy', 'sunflower', 'pine nut']):
        return 'Nuts & Seeds'
    if any(w in n for w in ['chocolate', 'cocoa', 'cacao', 'chips', 'fudge', 'carob']):
        return 'Chocolate & Cocoa'
    if any(w in n for w in ['apple', 'berry', 'blueberr', 'raisin', 'cranberr', 'date', 'fig', 'banana', 'cherry', 'fruit', 'pumpkin', 'carrot', 'potato', 'puree', 'lemon', 'orange', 'lime', 'onion', 'garlic', 'rhubarb', 'currant', 'pesto']):
        return 'Fruits & Vegetables'
    if any(w in n for w in ['water', 'juice', 'cider', 'coffee', 'tea', 'vinegar', 'liqueur', 'rum', 'bourbon', 'wine', 'beer']):
        return 'Liquids & Syrups'
    return default

def main():
    print("Reading LA Times Weight Chart...")
    wb = openpyxl.load_workbook(EXCEL_PATH)
    sheet = wb.active
    headers = [cell.value for cell in sheet[1]]
    
    latimes_items = []
    for r in range(2, sheet.max_row + 1):
        cat = sheet.cell(r, 1).value
        ing = sheet.cell(r, 2).value
        if not ing: continue
        ing_clean = clean_name(str(ing))
        
        vols = {}
        for c in range(3, len(headers) + 1):
            h = headers[c - 1]
            val = sheet.cell(r, c).value
            if val is not None and str(val).strip() != '':
                try:
                    vols[h] = float(val)
                except ValueError:
                    pass
        
        cup_g = vols.get('1 Cup')
        if cup_g is None and '1/2 Cup' in vols:
            cup_g = vols['1/2 Cup'] * 2
        elif cup_g is None and '1 TBSP' in vols:
            cup_g = vols['1 TBSP'] * 16

        cat_unified = CATEGORY_MAP.get(cat, infer_category(ing_clean))
        
        latimes_items.append({
            'name': ing_clean,
            'category_orig': cat,
            'category': cat_unified,
            'cup_grams': round(cup_g, 1) if cup_g else None,
            'volumes': vols
        })
    print(f"Loaded {len(latimes_items)} LA Times ingredients.")

    print("Reading King Arthur Baking Ingredient Weight Chart...")
    reader = pypdf.PdfReader(PDF_PATH)
    ka_items = []
    vol_regex = re.compile(r'^(.*?)\s+((?:\d+(?:/\d+)?(?:\s+\d+/\d+)?|\d+\.\d+)?\s*(?:cups?|table\s*spoons?|tbsp|tea\s*spoons?|tsp|large(?:\s+head)?|pinch|cloves?|packet|can|stick|sticks)(?:\s*\([^)]+\))?)$', re.IGNORECASE)

    for p in reader.pages:
        for line in p.extract_text().split('\n'):
            s = line.strip()
            if not s or any(h in s for h in ['Ingredient Volume Ounces Grams', 'Ingredient Weight Chart', 'For best results', 'digital scale', 'ounces, and', 'kingarthurbaking.com', '11/9/26', 'equivalencies', 'Note: If', 'amounts for some', 'use, go by']):
                continue
            m = re.search(r'\s+([\d/.\s]+?(?:\s+to\s+[\d/.\s]+?)?)\s+(\d+(?:\s+to\s+\d+)?)$', s)
            if not m:
                continue
            oz_str = m.group(1).strip()
            grams_str = m.group(2).strip()
            prefix = s[:m.start()].strip()
            
            vm = vol_regex.match(prefix)
            if vm:
                ing_name = clean_name(vm.group(1))
                vol_str = clean_name(vm.group(2))
            else:
                ing_name = clean_name(prefix)
                vol_str = "1 cup"
            
            # Parse grams
            if 'to' in grams_str:
                g_parts = [float(x) for x in grams_str.split('to')]
                g_val = sum(g_parts) / len(g_parts)
                g_range = [int(g_parts[0]), int(g_parts[1])]
            else:
                g_val = float(grams_str)
                g_range = None
            
            cups = parse_volume_to_cups(vol_str)
            if cups and cups > 0:
                cup_grams = round(g_val / cups, 1)
            else:
                cup_grams = None
            
            cat_unified = infer_category(ing_name)
            
            ka_items.append({
                'name': ing_name,
                'volume_str': vol_str,
                'ounces_str': oz_str,
                'grams': round(g_val, 1),
                'grams_range': g_range,
                'cups_equiv': round(cups, 4) if cups else None,
                'cup_grams': cup_grams,
                'category': cat_unified
            })
    print(f"Loaded {len(ka_items)} King Arthur ingredients.")

    # Match and Merge
    merged_items = []
    ka_by_name = {item['name']: item for item in ka_items}
    ka_by_norm = {normalize_key(item['name']): item for item in ka_items}
    
    used_ka_names = set()
    
    # Process LA Times items first, linking to KA where matching
    for la in latimes_items:
        la_name = la['name']
        ka_match = None
        
        # 1. Check explicit synonyms
        if la_name.lower() in EXPLICIT_SYNONYMS:
            target_ka = EXPLICIT_SYNONYMS[la_name.lower()]
            ka_match = ka_by_name.get(target_ka)
            
        # 2. Check exact normalized key
        if not ka_match:
            norm_k = normalize_key(la_name)
            ka_match = ka_by_norm.get(norm_k)
            
        # 3. Check partial inclusion
        if not ka_match:
            norm_k = normalize_key(la_name)
            for k, candidate in ka_by_norm.items():
                if k == norm_k or (len(norm_k) > 5 and norm_k in k):
                    ka_match = candidate
                    break

        # Display name selection
        if ka_match:
            display_name = ka_match['name']
            used_ka_names.add(ka_match['name'])
            category = la['category'] or ka_match['category']
        else:
            display_name = la_name.capitalize()
            category = la['category']

        cup_g = ka_match['cup_grams'] if (ka_match and ka_match.get('cup_grams')) else la.get('cup_grams')
        
        item = {
            'id': re.sub(r'[^a-z0-9]+', '-', display_name.lower()).strip('-'),
            'name': display_name,
            'category': category,
            'cup_grams': cup_g,
            'tbsp_grams': round(cup_g / 16.0, 2) if cup_g else None,
            'tsp_grams': round(cup_g / 48.0, 2) if cup_g else None,
            'ml_grams': round(cup_g / 236.588, 3) if cup_g else None,
            'sources': {
                'king_arthur': {
                    'available': ka_match is not None,
                    'volume': ka_match['volume_str'] if ka_match else None,
                    'grams': ka_match['grams'] if ka_match else None,
                    'ounces': ka_match['ounces_str'] if ka_match else None,
                    'cup_grams': ka_match['cup_grams'] if ka_match else None,
                    'method': 'Fluff in bin, spoon gently into measuring cup, sweep level.'
                } if ka_match else None,
                'la_times': {
                    'available': True,
                    'name': la['name'],
                    'cup_grams': la['cup_grams'],
                    'volumes': la['volumes'],
                    'method': 'Dip cup directly into container and sweep level (standard test kitchen).'
                }
            }
        }
        
        if ka_match and ka_match.get('cup_grams') and la.get('cup_grams'):
            diff = la['cup_grams'] - ka_match['cup_grams']
            pct = (diff / ka_match['cup_grams']) * 100.0
            if abs(pct) >= 1.0:
                item['comparison'] = {
                    'diff_grams': round(diff, 1),
                    'diff_percent': round(pct, 1),
                    'note': f"LA Times ({la['cup_grams']}g/cup) is {abs(round(pct, 1))}% {'heavier' if diff > 0 else 'lighter'} than King Arthur ({ka_match['cup_grams']}g/cup)."
                }
            else:
                item['comparison'] = {
                    'diff_grams': round(diff, 1),
                    'diff_percent': round(pct, 1),
                    'note': f"Virtually identical between King Arthur ({ka_match['cup_grams']}g/cup) and LA Times ({la['cup_grams']}g/cup)."
                }

        merged_items.append(item)

    # Process remaining King Arthur items
    for ka in ka_items:
        if ka['name'] in used_ka_names:
            continue
        display_name = ka['name']
        cup_g = ka.get('cup_grams')
        
        item = {
            'id': re.sub(r'[^a-z0-9]+', '-', display_name.lower()).strip('-'),
            'name': display_name,
            'category': ka['category'],
            'cup_grams': cup_g,
            'tbsp_grams': round(cup_g / 16.0, 2) if cup_g else None,
            'tsp_grams': round(cup_g / 48.0, 2) if cup_g else None,
            'ml_grams': round(cup_g / 236.588, 3) if cup_g else None,
            'sources': {
                'king_arthur': {
                    'available': True,
                    'volume': ka['volume_str'],
                    'grams': ka['grams'],
                    'ounces': ka['ounces_str'],
                    'cup_grams': ka['cup_grams'],
                    'method': 'Fluff in bin, spoon gently into measuring cup, sweep level.'
                },
                'la_times': None
            }
        }
        merged_items.append(item)

    # Sort alphabetically
    merged_items.sort(key=lambda x: x['name'].lower())

    categories = sorted(list(set(x['category'] for x in merged_items)))
    output_data = {
        'version': '1.0.0',
        'generated_at': '2026-11-09',
        'total_ingredients': len(merged_items),
        'categories': categories,
        'sources': {
            'king_arthur': {
                'name': 'King Arthur Baking',
                'description': 'Fluff & Spoon method (fluff flour, gently spoon into cup, sweep level). Ideal for yeast breads and delicate cakes.'
            },
            'la_times': {
                'name': 'Los Angeles Times Test Kitchen',
                'description': 'Dip & Sweep method (dip measuring cup directly into ingredient and sweep level). Standard California baking chart.'
            }
        },
        'ingredients': merged_items
    }

    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    print(f"Wrote JSON to {OUTPUT_JSON} ({len(merged_items)} items)")

    with open(OUTPUT_JS, 'w', encoding='utf-8') as f:
        f.write("window.BAKING_DATA = ")
        json.dump(output_data, f, indent=2, ensure_ascii=False)
        f.write(";\n")
    print(f"Wrote JS to {OUTPUT_JS}")

if __name__ == '__main__':
    main()
