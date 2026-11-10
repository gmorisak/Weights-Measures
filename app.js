// Weights & Measures - Baking Conversion Engine & Application Controller

(function () {
  'use strict';

  // --- State Management ---
  const state = {
    ingredients: [],
    categories: [],
    selectedIngredient: null,
    conversionMode: 'vol-to-weight', // 'vol-to-weight' or 'weight-to-vol'
    currentVolumeValue: 1.0,
    currentVolumeUnit: 'cup', // 'cup', 'tbsp', 'tsp', 'ml', 'floz'
    currentWeightValue: 120.0,
    currentWeightUnit: 'g', // 'g', 'oz', 'lb'
    preferredSource: 'king_arthur', // 'king_arthur' or 'la_times'
    selectedCategory: 'All',
    searchQuery: '',
    recipeItems: [],
    recipeScale: 1.0,
    wakeLock: null,
    kitchenMode: false,
    activeTab: 'converter'
  };

  // Unit conversion factors to 1 US Cup
  // 1 US Cup = 16 tbsp = 48 tsp = 236.588 ml = 8 fl oz
  const VOLUME_TO_CUPS = {
    'cup': 1.0,
    'tbsp': 1.0 / 16.0,
    'tsp': 1.0 / 48.0,
    'ml': 1.0 / 236.588,
    'floz': 1.0 / 8.0
  };

  // --- Initialization ---
  function init() {
    loadData();
    loadStoredRecipe();
    setupTheme();
    setupEventListeners();
    setupServiceWorker();
    renderConverter();
    renderLibrary();
    renderRecipe();
  }

  function loadData() {
    if (window.BAKING_DATA && window.BAKING_DATA.ingredients) {
      state.ingredients = window.BAKING_DATA.ingredients;
      state.categories = ['All', ...window.BAKING_DATA.categories];
    } else {
      console.warn('BAKING_DATA not loaded synchronously, attempting fetch...');
      fetch('./data/baking_data.json')
        .then(res => res.json())
        .then(data => {
          state.ingredients = data.ingredients;
          state.categories = ['All', ...data.categories];
          renderConverter();
          renderLibrary();
        })
        .catch(err => console.error('Failed to load baking data:', err));
    }

    // Default ingredient: All-Purpose Flour
    if (state.ingredients.length > 0) {
      const defaultItem = state.ingredients.find(i => i.id === 'all-purpose-flour') || state.ingredients[0];
      state.selectedIngredient = defaultItem;
    }
  }

  // --- Service Worker & PWA ---
  function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('ServiceWorker registered:', reg.scope))
          .catch(err => console.log('ServiceWorker registration failed:', err));
      });
    }

    // Check if running in standalone mode (installed PWA)
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    const banner = document.getElementById('pwaInstallCard');
    if (isStandalone && banner) {
      banner.style.display = 'none';
    }
  }

  // --- Theme Toggle ---
  function setupTheme() {
    const savedTheme = localStorage.getItem('wm_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('wm_theme', next);
  }

  // --- Kitchen Mode (Wake Lock) ---
  async function toggleKitchenMode() {
    const btn = document.getElementById('btnKitchenMode');
    if (!state.kitchenMode) {
      try {
        if ('wakeLock' in navigator) {
          state.wakeLock = await navigator.wakeLock.request('screen');
          state.kitchenMode = true;
          btn.classList.add('active');
          btn.setAttribute('title', 'Kitchen Mode: Screen kept awake');
        } else {
          alert('Screen Wake Lock is not supported on this browser version, but app is ready!');
        }
      } catch (err) {
        console.warn('Wake Lock request error:', err);
      }
    } else {
      if (state.wakeLock) {
        await state.wakeLock.release();
        state.wakeLock = null;
      }
      state.kitchenMode = false;
      btn.classList.remove('active');
      btn.setAttribute('title', 'Kitchen Mode: Keep screen awake');
    }
  }

  // --- Tab Navigation ---
  function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === `view-${tabName}`);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- Calculation Helpers ---
  function getGramsPerCup(ingredient, sourcePref) {
    if (!ingredient) return 120.0;
    const ka = ingredient.sources.king_arthur;
    const la = ingredient.sources.la_times;

    if (sourcePref === 'la_times' && la && la.cup_grams) {
      return la.cup_grams;
    }
    if (ka && ka.cup_grams) {
      return ka.cup_grams;
    }
    if (la && la.cup_grams) {
      return la.cup_grams;
    }
    return ingredient.cup_grams || 120.0;
  }

  function calculateVolumeToWeight(ingredient, volValue, volUnit, sourcePref) {
    const cups = volValue * (VOLUME_TO_CUPS[volUnit] || 1.0);
    const cupGrams = getGramsPerCup(ingredient, sourcePref);
    const totalGrams = cups * cupGrams;
    const totalOunces = totalGrams / 28.3495;
    const totalPounds = totalOunces / 16.0;

    return {
      grams: Math.round(totalGrams * 10) / 10,
      ounces: Math.round(totalOunces * 100) / 100,
      pounds: Math.round(totalPounds * 100) / 100,
      cupsEquivalent: cups
    };
  }

  function calculateWeightToVolume(ingredient, weightValue, weightUnit, sourcePref) {
    let grams = weightValue;
    if (weightUnit === 'oz') grams = weightValue * 28.3495;
    if (weightUnit === 'lb') grams = weightValue * 453.592;

    const cupGrams = getGramsPerCup(ingredient, sourcePref);
    const cups = grams / cupGrams;
    const tbsp = cups * 16.0;
    const tsp = cups * 48.0;
    const ml = cups * 236.588;

    return {
      cups: Math.round(cups * 100) / 100,
      tbsp: Math.round(tbsp * 10) / 10,
      tsp: Math.round(tsp * 10) / 10,
      ml: Math.round(ml)
    };
  }

  function formatFraction(val) {
    const whole = Math.floor(val);
    const frac = val - whole;
    const tolerance = 0.04;

    const fractions = [
      { val: 0.125, str: '1/8' },
      { val: 0.25, str: '1/4' },
      { val: 0.333, str: '1/3' },
      { val: 0.5, str: '1/2' },
      { val: 0.666, str: '2/3' },
      { val: 0.75, str: '3/4' }
    ];

    let matchStr = '';
    for (const f of fractions) {
      if (Math.abs(frac - f.val) <= tolerance) {
        matchStr = f.str;
        break;
      }
    }

    if (matchStr) {
      return whole > 0 ? `${whole} ${matchStr}` : matchStr;
    }
    return val % 1 === 0 ? val.toString() : val.toFixed(2);
  }

  // --- Render Converter ---
  function renderConverter() {
    const ing = state.selectedIngredient;
    if (!ing) return;

    // Selected ingredient banner
    const selName = document.getElementById('selectedIngName');
    const selCat = document.getElementById('selectedIngCat');
    const sourceBadges = document.getElementById('selectedSourceBadges');
    
    if (selName) selName.textContent = ing.name;
    if (selCat) selCat.textContent = ing.category;

    if (sourceBadges) {
      let badgesHtml = '';
      if (ing.sources.king_arthur && ing.sources.king_arthur.available) {
        badgesHtml += `<span class="source-badge">King Arthur (${ing.sources.king_arthur.cup_grams}g/c)</span> `;
      }
      if (ing.sources.la_times && ing.sources.la_times.available) {
        badgesHtml += `<span class="source-badge" style="background:rgba(59,130,246,0.15);color:#2563EB;">LA Times (${ing.sources.la_times.cup_grams}g/c)</span>`;
      }
      sourceBadges.innerHTML = badgesHtml;
    }

    // Input mode handling
    const isVolToWeight = state.conversionMode === 'vol-to-weight';
    const inputLabel = document.getElementById('inputValLabel');
    const selectUnit = document.getElementById('unitSelector');
    const fracGrid = document.getElementById('fractionGrid');
    const swapBtnText = document.getElementById('swapBtnText');

    if (isVolToWeight) {
      if (inputLabel) inputLabel.textContent = 'Volume Amount';
      if (fracGrid) fracGrid.style.display = 'grid';
      if (swapBtnText) swapBtnText.textContent = 'Switch to Weight → Volume';
      if (selectUnit) {
        selectUnit.innerHTML = `
          <option value="cup">Cups (c)</option>
          <option value="tbsp">Tablespoons (tbsp)</option>
          <option value="tsp">Teaspoons (tsp)</option>
          <option value="ml">Milliliters (mL)</option>
          <option value="floz">Fluid Ounces (fl oz)</option>
        `;
        selectUnit.value = state.currentVolumeUnit;
      }
      document.getElementById('primaryInputValue').value = state.currentVolumeValue;

      // Calculate output
      const result = calculateVolumeToWeight(ing, state.currentVolumeValue, state.currentVolumeUnit, state.preferredSource);
      
      document.getElementById('resPrimaryLabel').textContent = 'Weight in Grams';
      document.getElementById('resPrimaryValue').innerHTML = `${result.grams}<span>g</span>`;
      document.getElementById('resSecOunces').textContent = `${result.ounces} oz`;
      
      const lbBox = document.getElementById('resSecPoundsBox');
      if (result.ounces >= 16 && lbBox) {
        lbBox.style.display = 'flex';
        document.getElementById('resSecPounds').textContent = `${result.pounds} lb`;
      } else if (lbBox) {
        lbBox.style.display = 'none';
      }

    } else {
      // Weight to Volume mode
      if (inputLabel) inputLabel.textContent = 'Weight Amount';
      if (fracGrid) fracGrid.style.display = 'none';
      if (swapBtnText) swapBtnText.textContent = 'Switch to Volume → Weight';
      if (selectUnit) {
        selectUnit.innerHTML = `
          <option value="g">Grams (g)</option>
          <option value="oz">Ounces (oz)</option>
          <option value="lb">Pounds (lb)</option>
        `;
        selectUnit.value = state.currentWeightUnit;
      }
      document.getElementById('primaryInputValue').value = state.currentWeightValue;

      const result = calculateWeightToVolume(ing, state.currentWeightValue, state.currentWeightUnit, state.preferredSource);
      
      document.getElementById('resPrimaryLabel').textContent = 'Volume in Cups';
      document.getElementById('resPrimaryValue').innerHTML = `${formatFraction(result.cups)} <span>cups</span>`;
      document.getElementById('resSecOunces').textContent = `${result.tbsp} tbsp`;
      
      const lbBox = document.getElementById('resSecPoundsBox');
      if (lbBox) {
        lbBox.style.display = 'flex';
        document.getElementById('resSecPoundsLabel').textContent = 'TSP:';
        document.getElementById('resSecPounds').textContent = `${result.tsp} tsp (${result.ml} mL)`;
      }
    }

    // Comparison Card
    renderComparisonCard(ing);
  }

  function renderComparisonCard(ing) {
    const compCard = document.getElementById('comparisonCard');
    if (!compCard) return;

    const ka = ing.sources.king_arthur;
    const la = ing.sources.la_times;

    if (!ka || !la || !ka.cup_grams || !la.cup_grams) {
      compCard.style.display = 'none';
      return;
    }

    compCard.style.display = 'block';
    document.getElementById('compKaGrams').textContent = `${ka.cup_grams}g`;
    document.getElementById('compLaGrams').textContent = `${la.cup_grams}g`;

    const noteEl = document.getElementById('compNote');
    if (noteEl) {
      if (ing.comparison && ing.comparison.note) {
        noteEl.textContent = ing.comparison.note;
      } else {
        const diff = Math.round((la.cup_grams - ka.cup_grams) * 10) / 10;
        noteEl.textContent = `LA Times is ${diff > 0 ? '+' : ''}${diff}g per cup compared to King Arthur.`;
      }
    }
  }

  // --- Autocomplete Search ---
  function setupAutocomplete() {
    const input = document.getElementById('ingredientSearchInput');
    const dropdown = document.getElementById('autocompleteDropdown');
    const clearBtn = document.getElementById('clearSearchBtn');

    if (!input || !dropdown) return;

    input.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      state.searchQuery = q;
      if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

      if (!q) {
        dropdown.classList.remove('visible');
        dropdown.innerHTML = '';
        return;
      }

      const filtered = state.ingredients.filter(item => {
        const matchesQuery = item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
        const matchesCat = state.selectedCategory === 'All' || item.category === state.selectedCategory;
        return matchesQuery && matchesCat;
      }).slice(0, 8);

      if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="auto-item" style="color:var(--text-muted);">No baking ingredients found</div>';
        dropdown.classList.add('visible');
        return;
      }

      dropdown.innerHTML = filtered.map(item => `
        <div class="auto-item" data-id="${item.id}">
          <div>
            <strong>${item.name}</strong>
            <div style="font-size:0.72rem;color:var(--text-secondary);">${item.category}</div>
          </div>
          <span style="font-weight:700;color:var(--accent);">${item.cup_grams}g/c</span>
        </div>
      `).join('');
      dropdown.classList.add('visible');
    });

    dropdown.addEventListener('click', (e) => {
      const row = e.target.closest('.auto-item');
      if (row && row.dataset.id) {
        const selected = state.ingredients.find(i => i.id === row.dataset.id);
        if (selected) {
          state.selectedIngredient = selected;
          input.value = selected.name;
          dropdown.classList.remove('visible');
          renderConverter();
        }
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        state.searchQuery = '';
        clearBtn.style.display = 'none';
        dropdown.classList.remove('visible');
      });
    }

    // Dismiss dropdown on tap outside
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('visible');
      }
    });
  }

  // --- Category Pills ---
  function renderCategoryPills() {
    const container = document.getElementById('categoryPills');
    if (!container) return;

    container.innerHTML = state.categories.map(cat => `
      <button class="pill-btn ${state.selectedCategory === cat ? 'active' : ''}" data-cat="${cat}">
        ${cat}
      </button>
    `).join('');

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill-btn');
      if (btn && btn.dataset.cat) {
        state.selectedCategory = btn.dataset.cat;
        container.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderLibrary();
      }
    });
  }

  // --- Library Table View ---
  function renderLibrary() {
    const listEl = document.getElementById('libraryIngredientList');
    if (!listEl) return;

    const filtered = state.ingredients.filter(item => {
      const matchesCat = state.selectedCategory === 'All' || item.category === state.selectedCategory;
      const q = state.searchQuery.toLowerCase();
      const matchesQ = !q || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
      return matchesCat && matchesQ;
    });

    document.getElementById('libraryCount').textContent = `${filtered.length} ingredients`;

    listEl.innerHTML = filtered.map(item => {
      const kaGrams = item.sources.king_arthur?.cup_grams ? `${item.sources.king_arthur.cup_grams}g` : '—';
      const laGrams = item.sources.la_times?.cup_grams ? `${item.sources.la_times.cup_grams}g` : '—';
      return `
        <tr data-id="${item.id}" style="cursor:pointer;">
          <td>
            <div style="font-weight:600;">${item.name}</div>
            <div style="font-size:0.72rem;color:var(--text-secondary);">${item.category}</div>
          </td>
          <td style="font-weight:700;color:var(--accent);">${kaGrams}</td>
          <td style="font-weight:700;color:#2563EB;">${laGrams}</td>
          <td>
            <button class="btn-icon" data-action="use" data-id="${item.id}" title="Use in Converter" style="width:30px;height:30px;">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    listEl.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (tr && tr.dataset.id) {
        const item = state.ingredients.find(i => i.id === tr.dataset.id);
        if (item) {
          state.selectedIngredient = item;
          document.getElementById('ingredientSearchInput').value = item.name;
          renderConverter();
          switchTab('converter');
        }
      }
    });
  }

  // --- Recipe Worksheet ---
  function loadStoredRecipe() {
    try {
      const saved = localStorage.getItem('wm_baking_recipe');
      if (saved) {
        state.recipeItems = JSON.parse(saved);
      } else {
        // Default starter recipe: Classic Artisan Bread
        state.recipeItems = [
          { id: 'all-purpose-flour', name: 'All-Purpose Flour', volume: 3, unit: 'cup', grams: 360, category: 'Grains & Flours' },
          { id: 'water', name: 'Water', volume: 1.25, unit: 'cup', grams: 295, category: 'Liquids & Syrups' },
          { id: 'salt-kosher-diamond-crystal', name: 'Salt (kosher, Diamond Crystal)', volume: 1.5, unit: 'tsp', grams: 4.5, category: 'Leaveners & Spices' },
          { id: 'instant-yeast', name: 'Instant yeast', volume: 1, unit: 'tsp', grams: 3, category: 'Leaveners & Spices' }
        ];
      }
    } catch (e) {
      state.recipeItems = [];
    }
  }

  function saveRecipe() {
    localStorage.setItem('wm_baking_recipe', JSON.stringify(state.recipeItems));
  }

  function addCurrentToRecipe() {
    const ing = state.selectedIngredient;
    if (!ing) return;

    const res = calculateVolumeToWeight(ing, state.currentVolumeValue, state.currentVolumeUnit, state.preferredSource);
    state.recipeItems.push({
      id: ing.id,
      name: ing.name,
      volume: state.currentVolumeValue,
      unit: state.currentVolumeUnit,
      grams: res.grams,
      category: ing.category
    });

    saveRecipe();
    renderRecipe();
    switchTab('recipe');
  }

  function renderRecipe() {
    const listEl = document.getElementById('recipeItemsList');
    if (!listEl) return;

    if (state.recipeItems.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:24px 16px;color:var(--text-muted);font-size:0.85rem;">
          No ingredients added yet.<br>Convert an ingredient and tap <strong>"Add to Recipe"</strong>!
        </div>
      `;
      document.getElementById('recipeTotalGrams').textContent = '0g';
      document.getElementById('recipeTotalOunces').textContent = '0 oz';
      return;
    }

    let totalGrams = 0;
    let flourGrams = 0;

    // Calculate totals with multiplier
    state.recipeItems.forEach(item => {
      const g = item.grams * state.recipeScale;
      totalGrams += g;
      if (item.category === 'Grains & Flours' || item.name.toLowerCase().includes('flour')) {
        flourGrams += g;
      }
    });

    listEl.innerHTML = state.recipeItems.map((item, index) => {
      const scaledGrams = Math.round(item.grams * state.recipeScale * 10) / 10;
      const scaledVol = Math.round(item.volume * state.recipeScale * 100) / 100;
      const pct = flourGrams > 0 ? Math.round((scaledGrams / flourGrams) * 100) : null;
      const pctStr = pct !== null ? `(${pct}% flour)` : '';

      return `
        <div class="recipe-item-row">
          <div class="recipe-item-info">
            <span class="recipe-item-name">${item.name}</span>
            <span class="recipe-item-vol">${formatFraction(scaledVol)} ${item.unit} ${pctStr}</span>
          </div>
          <div class="recipe-item-weight">
            <span class="recipe-item-grams">${scaledGrams}g</span>
            <button class="recipe-item-delete" data-index="${index}" title="Remove">✕</button>
          </div>
        </div>
      `;
    }).join('');

    const totalOz = Math.round((totalGrams / 28.3495) * 10) / 10;
    document.getElementById('recipeTotalGrams').textContent = `${Math.round(totalGrams)}g`;
    document.getElementById('recipeTotalOunces').textContent = `${totalOz} oz (${Math.round((totalOz/16)*10)/10} lb)`;

    // Hydration calculation if flour present
    const hydrationBox = document.getElementById('bakerHydrationBox');
    if (flourGrams > 0 && hydrationBox) {
      let liquidGrams = 0;
      state.recipeItems.forEach(item => {
        if (item.category === 'Liquids & Syrups' || item.name.toLowerCase().includes('water') || item.name.toLowerCase().includes('milk')) {
          liquidGrams += (item.grams * state.recipeScale);
        }
      });
      const hydrationPct = Math.round((liquidGrams / flourGrams) * 100);
      hydrationBox.style.display = 'block';
      document.getElementById('bakerHydrationValue').textContent = `${hydrationPct}% Hydration`;
    } else if (hydrationBox) {
      hydrationBox.style.display = 'none';
    }

    // Attach delete listeners
    listEl.querySelectorAll('.recipe-item-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.index, 10);
        state.recipeItems.splice(idx, 1);
        saveRecipe();
        renderRecipe();
      });
    });
  }

  // --- Natural Language Ingredient Matcher ---
  function findIngredientMatch(rawName) {
    if (!rawName) return null;
    const norm = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');

    const SYNONYMS = {
      'flour': 'all-purpose-flour',
      'apflour': 'all-purpose-flour',
      'whiteflour': 'all-purpose-flour',
      'breadflour': 'unbleached-bread-flour',
      'wholewheatflour': 'whole-wheat-flour-premium-100-',
      'wheatflour': 'whole-wheat-flour-premium-100-',
      'sugar': 'sugar-granulated-white',
      'whitesugar': 'sugar-granulated-white',
      'granulatedsugar': 'sugar-granulated-white',
      'brownsugar': 'brown-sugar-dark-or-light-packed',
      'packedbrownsugar': 'brown-sugar-dark-or-light-packed',
      'lightbrownsugar': 'brown-sugar-dark-or-light-packed',
      'darkbrownsugar': 'brown-sugar-dark-or-light-packed',
      'powderedsugar': 'confectioners-sugar-unsifted',
      'confectionerssugar': 'confectioners-sugar-unsifted',
      'butter': 'butter',
      'unsaltedbutter': 'butter',
      'saltedbutter': 'butter',
      'egg': 'egg-fresh',
      'eggs': 'egg-fresh',
      'largeegg': 'egg-fresh',
      'largeeggs': 'egg-fresh',
      'milk': 'milk-fresh',
      'wholemilk': 'milk-fresh',
      'chocolatechips': 'chocolate-chips',
      'semisweetchocolatechips': 'chocolate-chips',
      'darkchocolatechips': 'chocolate-chips',
      'cocoa': 'cocoa-dry-baking',
      'cocoapowder': 'cocoa-dry-baking',
      'salt': 'salt-kosher-diamond-crystal',
      'koshersalt': 'salt-kosher-diamond-crystal',
      'tablesalt': 'salt-table',
      'bakingpowder': 'baking-powder',
      'bakingsoda': 'baking-soda',
      'yeast': 'instant-yeast',
      'instantyeast': 'instant-yeast',
      'activedryyeast': 'active-dry-yeast',
      'oil': 'vegetable-oil',
      'vegetableoil': 'vegetable-oil',
      'oliveoil': 'olive-oil',
      'canolaoil': 'vegetable-oil',
      'water': 'water',
      'warmwater': 'water',
      'vanilla': 'vanilla-extract',
      'vanillaextract': 'vanilla-extract',
      'honey': 'honey',
      'molasses': 'molasses',
      'maplesyrup': 'maple-syrup',
      'cinnamon': 'cinnamon-ground',
      'oats': 'rolled-oats',
      'rolledoats': 'rolled-oats',
      'walnuts': 'walnuts-chopped',
      'pecans': 'pecans-diced',
      'almonds': 'almonds-sliced'
    };

    if (SYNONYMS[norm]) {
      const found = state.ingredients.find(i => i.id === SYNONYMS[norm]);
      if (found) return found;
    }

    // Direct normalized match
    for (const item of state.ingredients) {
      const itemNorm = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (itemNorm === norm) return item;
    }

    // Inclusion match
    for (const item of state.ingredients) {
      const itemNorm = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (itemNorm.includes(norm) || (norm.length >= 4 && norm.includes(itemNorm))) {
        return item;
      }
    }

    // Token overlap matching
    const tokens = rawName.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    let best = null;
    let bestScore = 0;
    for (const item of state.ingredients) {
      const itemTokens = item.name.toLowerCase().split(/[\s(),/]+/).filter(t => t.length > 2);
      let matchCount = 0;
      tokens.forEach(t => {
        if (itemTokens.some(it => it.includes(t) || t.includes(it))) matchCount++;
      });
      if (matchCount > bestScore) {
        bestScore = matchCount;
        best = item;
      }
    }
    if (bestScore >= 1) return best;

    return null;
  }

  // --- Natural Language Recipe Parser ---
  function parseRecipeText(text, sourcePref) {
    if (!text || !text.trim()) return;

    const lines = text.split('\n');
    const parsedItems = [];

    lines.forEach(line => {
      let l = line.trim();
      if (!l || l.startsWith('#') || l.endsWith(':')) return;

      // Strip bullet points or numbered lists: "- ", "* ", "1. ", "1) "
      let cleaned = l.replace(/^[\s\-*•]+/, '').replace(/^(\d+\)\s*|\d+\.\s+)/, '').trim();
      if (!cleaned) return;

      // Handle pinch/dash
      if (/^pinch\s+(?:of\s+)?/i.test(cleaned)) {
        const ingStr = cleaned.replace(/^pinch\s+(?:of\s+)?/i, '').trim();
        const matched = findIngredientMatch(ingStr);
        parsedItems.push({
          id: matched ? matched.id : 'custom-pinch',
          name: matched ? matched.name : ingStr,
          volume: 0.125,
          unit: 'tsp',
          grams: 0.5,
          category: matched ? matched.category : 'Leaveners & Spices'
        });
        return;
      }

      // Quantity pattern: fractions (2 1/2, 1/4), decimals (1.5), integers (2)
      const qtyMatch = cleaned.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.\d+|\d+)\s*(.*)$/);
      const rawQty = qtyMatch ? qtyMatch[1] : '1';
      const remainder = qtyMatch ? qtyMatch[2].trim() : cleaned;

      const unitMatch = remainder.match(/^(cups?|c\.|c|tablespoons?|tbsp|tbs|teaspoons?|tsp|sticks?|stick|ml|grams?|g|oz|ounces?|large|fl\s*oz)\b\.?\s*(?:of\s+)?(.*)$/i);
      let unit = 'cup';
      let ingStr = remainder;

      if (unitMatch) {
        unit = unitMatch[1].toLowerCase().replace(/\.$/, '');
        ingStr = unitMatch[2].trim();
      }

      if (unit === 'c' || unit === 'cups') unit = 'cup';
      if (unit === 'tablespoon' || unit === 'tablespoons' || unit === 'tbs') unit = 'tbsp';
      if (unit === 'teaspoon' || unit === 'teaspoons') unit = 'tsp';
      if (unit === 'sticks') unit = 'stick';
      if (unit === 'grams') unit = 'g';
      if (unit === 'ounces') unit = 'oz';

      // Clean descriptive suffixes: ", softened", ", room temperature", ", melted", etc.
      ingStr = ingStr.replace(/,\s*(softened|melted|room temperature|sifted|divided|beaten|chopped|at room temperature|warmed|crushed).*$/i, '').trim();

      const numVal = parseFraction(rawQty);
      const matched = findIngredientMatch(ingStr);

      let grams = 0;
      if (unit === 'g') {
        grams = numVal;
      } else if (unit === 'oz') {
        grams = numVal * 28.3495;
      } else if (unit === 'large' || ingStr.toLowerCase().includes('egg')) {
        grams = numVal * 50; // standard large egg: 50g
      } else if (unit === 'stick') {
        grams = numVal * 113.4; // 1 stick butter = 113.4g (1/2 cup)
      } else if (matched) {
        const cups = numVal * (VOLUME_TO_CUPS[unit] || 1.0);
        const cupG = getGramsPerCup(matched, sourcePref);
        grams = cups * cupG;
      } else {
        // Fallback generic estimate: 1 cup ~= 150g
        const cups = numVal * (VOLUME_TO_CUPS[unit] || 1.0);
        grams = cups * 150;
      }

      parsedItems.push({
        id: matched ? matched.id : `custom-${ingStr.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name: matched ? matched.name : (ingStr.charAt(0).toUpperCase() + ingStr.slice(1)),
        volume: numVal,
        unit: unit,
        grams: Math.round(grams * 10) / 10,
        category: matched ? matched.category : 'Specialty & Other'
      });
    });

    if (parsedItems.length > 0) {
      state.recipeItems = parsedItems;
      saveRecipe();
      renderRecipe();
    }
  }

  // --- Copy Formatted Recipe to Clipboard ---
  function copyFormattedRecipe() {
    if (state.recipeItems.length === 0) return;

    let totalGrams = 0;
    let flourGrams = 0;

    state.recipeItems.forEach(item => {
      const g = item.grams * state.recipeScale;
      totalGrams += g;
      if (item.category === 'Grains & Flours' || item.name.toLowerCase().includes('flour')) {
        flourGrams += g;
      }
    });

    const lines = [
      'Weights & Measures Recipe',
      `Batch Scale: ${state.recipeScale}x | Total Weight: ${Math.round(totalGrams)}g (${(totalGrams / 28.3495).toFixed(1)} oz)`,
      ''
    ];

    state.recipeItems.forEach(item => {
      const scaledGrams = Math.round(item.grams * state.recipeScale * 10) / 10;
      const scaledVol = Math.round(item.volume * state.recipeScale * 100) / 100;
      const pct = flourGrams > 0 ? Math.round((scaledGrams / flourGrams) * 100) : null;
      const pctStr = pct !== null ? ` [${pct}% flour]` : '';
      lines.push(`• ${item.name}: ${scaledGrams}g (${formatFraction(scaledVol)} ${item.unit})${pctStr}`);
    });

    const textToCopy = lines.join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      const copyBtnText = document.getElementById('copyBtnText');
      if (copyBtnText) {
        const orig = copyBtnText.textContent;
        copyBtnText.textContent = 'Copied! ✓';
        setTimeout(() => { copyBtnText.textContent = orig; }, 2000);
      }
    }).catch(err => {
      console.warn('Clipboard write failed:', err);
      alert(textToCopy);
    });
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Theme toggle
    document.getElementById('btnThemeToggle')?.addEventListener('click', toggleTheme);

    // Kitchen mode
    document.getElementById('btnKitchenMode')?.addEventListener('click', toggleKitchenMode);

    // Tab buttons
    document.querySelectorAll('.tab-item').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Primary input value
    const primaryInput = document.getElementById('primaryInputValue');
    primaryInput?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 0;
      if (state.conversionMode === 'vol-to-weight') {
        state.currentVolumeValue = val;
      } else {
        state.currentWeightValue = val;
      }
      renderConverter();
    });

    // Unit selector
    document.getElementById('unitSelector')?.addEventListener('change', (e) => {
      if (state.conversionMode === 'vol-to-weight') {
        state.currentVolumeUnit = e.target.value;
      } else {
        state.currentWeightUnit = e.target.value;
      }
      renderConverter();
    });

    // Quick fraction buttons
    document.querySelectorAll('.frac-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const frac = parseFloat(btn.dataset.frac);
        const mode = btn.dataset.mode;
        if (mode === 'add') {
          state.currentVolumeValue = Math.round((state.currentVolumeValue + frac) * 100) / 100;
        } else {
          state.currentVolumeValue = frac;
        }
        renderConverter();
      });
    });

    // Swap conversion mode (Vol <-> Weight)
    document.getElementById('btnSwapMode')?.addEventListener('click', () => {
      if (state.conversionMode === 'vol-to-weight') {
        state.conversionMode = 'weight-to-vol';
        const res = calculateVolumeToWeight(state.selectedIngredient, state.currentVolumeValue, state.currentVolumeUnit, state.preferredSource);
        state.currentWeightValue = res.grams;
        state.currentWeightUnit = 'g';
      } else {
        state.conversionMode = 'vol-to-weight';
        const res = calculateWeightToVolume(state.selectedIngredient, state.currentWeightValue, state.currentWeightUnit, state.preferredSource);
        state.currentVolumeValue = res.cups;
        state.currentVolumeUnit = 'cup';
      }
      renderConverter();
    });

    // Add to recipe button
    document.getElementById('btnAddCurrentToRecipe')?.addEventListener('click', addCurrentToRecipe);

    // Recipe scale buttons
    document.querySelectorAll('.scale-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.recipeScale = parseFloat(btn.dataset.scale);
        renderRecipe();
      });
    });

    // Clear recipe
    document.getElementById('btnClearRecipe')?.addEventListener('click', () => {
      if (confirm('Clear all ingredients from this recipe?')) {
        state.recipeItems = [];
        saveRecipe();
        renderRecipe();
      }
    });

    // Parse Entire Recipe Button
    document.getElementById('btnParseRecipe')?.addEventListener('click', () => {
      const textarea = document.getElementById('pasteRecipeTextarea');
      const sourcePref = document.getElementById('pasteSourceSelector')?.value || 'king_arthur';
      if (textarea && textarea.value.trim()) {
        parseRecipeText(textarea.value, sourcePref);
      } else {
        alert('Please paste or type an ingredient list first!');
      }
    });

    // Try Recipe Example Button
    document.getElementById('btnTryRecipeExample')?.addEventListener('click', () => {
      const sample = [
        '2 1/4 cups all-purpose flour',
        '1 tsp baking soda',
        '1/2 tsp kosher salt',
        '1 cup unsalted butter, softened',
        '3/4 cup granulated sugar',
        '3/4 cup packed brown sugar',
        '1 tsp vanilla extract',
        '2 large eggs',
        '2 cups semi-sweet chocolate chips',
        '1 cup chopped walnuts'
      ].join('\n');
      const textarea = document.getElementById('pasteRecipeTextarea');
      if (textarea) textarea.value = sample;
      const sourcePref = document.getElementById('pasteSourceSelector')?.value || 'king_arthur';
      parseRecipeText(sample, sourcePref);
    });

    // Clear Pasted Text Button
    document.getElementById('btnClearPastedText')?.addEventListener('click', () => {
      const textarea = document.getElementById('pasteRecipeTextarea');
      if (textarea) textarea.value = '';
    });

    // Copy Recipe Button
    document.getElementById('btnCopyRecipe')?.addEventListener('click', copyFormattedRecipe);

    // Autocomplete & Category Pills
    setupAutocomplete();
    renderCategoryPills();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
