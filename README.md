# Weights & Measures — Precision Baking Converter 🥖⚖️

A progressive web app (PWA) designed for iOS and modern mobile devices that provides precision baking volume-to-weight conversions powered by authoritative culinary resources:
* **King Arthur Baking Ingredient Weight Chart** (Fluff & Spoon method: 120g/cup AP flour)
* **Los Angeles Times Test Kitchen Weight Chart** (Dip & Sweep method: 142g/cup AP flour)

---

## 📱 How to Push & Install on iPhone

### Option 1: Instant Local Wi-Fi Install (No account or build step required)

1. Run the local runner script on your Mac:
   ```bash
   ./serve.sh
   ```
2. A QR code and local URL (e.g., `http://192.168.0.119:8080`) will appear in your terminal.
3. Open your iPhone Camera and scan the QR code (or type the URL into Safari).
4. Tap the **Share** button (the square with an arrow pointing upward).
5. Scroll down and tap **"Add to Home Screen"**.
6. Tap **Add** in the top-right corner.
7. **Done!** The app icon will appear on your iPhone home screen and works **100% offline**.

### Option 2: Deploy to GitHub Pages (Permanent URL everywhere)

1. Open **GitHub Desktop**.
2. Commit and click **"Publish repository"** to push to your GitHub account (`gmorisak/Weights-and-Measures`).
3. In your repository on GitHub:
   - Go to **Settings** → **Pages**.
   - Under **Build and deployment**, set Source to **Deploy from a branch**.
   - Select branch `main` and folder `/ (root)`, then click **Save**.
4. Open the generated `https://<username>.github.io/<repo>/` link in Safari on your iPhone and tap **Share → Add to Home Screen**.

---

## ✨ Features

- **380+ Verified Baking Ingredients**: All flours, sugars, dairy, fats, leaveners, spices, nuts, chocolates, and fruits.
- **Dual-Source Comparison**: Compare King Arthur's fluff-and-spoon method (~120g/cup flour) against LA Times' dip-and-sweep method (~142g/cup flour) side-by-side with clear explanation notes.
- **Quick Fraction Selector**: One-tap buttons for `1/8`, `1/4`, `1/3`, `1/2`, `2/3`, `3/4`, `1`, `1½`, `2`, and additive buttons (`+¼`, `+½`, `+1`).
- **Two-Way Conversion**:
  - **Volume → Weight**: Convert Cups, Tablespoons, Teaspoons, mL, and fl oz into Grams (g), Ounces (oz), and Pounds (lb).
  - **Weight → Volume**: Enter grams or ounces and instantly get precise volume in cups, tablespoons, and teaspoons.
- **Recipe Worksheet & Batch Scaler**: Add multiple ingredients to calculate total dough/batter weight in grams and scale recipes (`0.5x`, `1x`, `1.5x`, `2x`, `3x`). Calculates dough hydration percentage automatically!
- **Kitchen Mode**: Built-in Screen Wake Lock button keeps your iPhone display awake while baking with messy hands.
- **Native iOS Aesthetic**: Designed following Apple Human Interface Guidelines with Light/Dark mode, smooth transitions, and high-resolution icons.
- **100% Offline Capability**: Powered by Service Worker cache — access all 387 ingredients even without internet in your kitchen.

---

## 🛠️ Data Pipeline

To re-parse or update the ingredient database from the personal resource files:
```bash
python3 scripts/parse_baking_data.py
```
This reads:
- `Ingredient Weight Chart _ King Arthur Baking.pdf`
- `LA Times Weight Chart.xlsx`

And generates:
- `data/baking_data.json` (Structured JSON)
- `data/baking_data.js` (Offline, zero-CORS script)

To regenerate app icons:
```bash
python3 scripts/generate_icons.py
```
