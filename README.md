# Calendar_Tool
Calendar, food ideas, feasts and fasts 


# Dormition Fast Companion

An installable Progressive Web App for a family keeping the Orthodox fasting year — built around the Dormition Fast, August 1–15, 2026, with the Feast of the Transfiguration on August 6 and the Feast of the Dormition on August 15.

Every fasting designation, saint and reading citation is parsed directly from the **official GOARCH Planner ICS** for the 2025–2026 ecclesiastical year. All 365 days are in the app, not just the fast. Nothing is inferred from general fasting rules.

No build tool, no package manager, no backend, no API key, no account, no database. Plain HTML, CSS, vanilla JavaScript and JSON. It runs directly from GitHub Pages and works offline after one successful visit.

---

## What it does

| Section | What's there |
|---|---|
| **Today** | Works on any of the 365 days. The GOARCH designation, permitted and set-aside foods, the day's saints and reading citations, which fasting season you're in, a *What to eat* card that leads with your starred favourites and reshuffles on demand, a **Coming up** card counting down to the next Great Feast, fish day, strict day and unrestricted day, a spiritual focus, a journal prompt, and progress through the Dormition journey when you're inside it. |
| **Calendar** | Five tabs. **The Year Wheel** — the app's signature: the whole ecclesiastical year drawn as one radial wheel, September at the top, every one of the 365 days a ray coloured by its designation, the four fasting seasons as inner arcs, the thirteen Great Feasts as gold marks, the family's Chrismation and Baptism days in Tabor blue, and a needle at today. Tap any ray to open that day. It prints as a one-page poster — a keepsake of the family's first year in the Church, generated entirely from the Planner data with nothing hand-placed. The month grid carries the same information for keyboard and screen-reader use, and the wheel says so. The other four tabs. *Dormition Fast* — the fifteen days as filterable cards. *Whole year* — a month grid, colour-coded, every day tappable. *Feasts & fasts* — the index, now twelve selectors: the Twelve Great Feasts and Pascha (each with its own ornamental emblem), **the Paschal cycle** (all 37 movable milestones from the Triodion's opening to All Saints, tagged Triodion / Great Lent / Holy Week / Bright Week / Pentecostarion), **the Sundays of Great Lent**, **the feasts of the Theotokos**, **forefeasts and leavetakings**, **the Wednesday/Friday exceptions**, the four fasting seasons, the fast-free weeks, fish days, strict days, dairy days, and named Sundays — every one with a countdown, every one derived from the Planner data by the build script, nothing hand-typed. *Find a saint* — search all 365 days. |
| **Meals** | ~195 meal ideas grouped by designation and tag; star any meal as a favourite; a **"What's in my kitchen?" pantry filter** (20 staple ingredients matched against meal names — a rough guide, not a recipe database); ten concrete oil-free techniques with the added-oil vs whole-food-fat distinction stated plainly and left to one's priest; a planner covering the Dormition Fast or the next seven days from today; **20 full recipe cards**; three August 6 celebration menus. No grocery list, by design. |
| **Journey** | A vertical timeline through the fourteen days with writable fields at the hinge points — August 1, the Paraklesis block, August 5, August 14, August 15. |
| **Feasts** | Transfiguration and Dormition sections with readings, explanation, source links, an **icon slot you can load your own licensed image into**, and the personal Chrismation/Baptism keepsake panel. Every Great Feast also carries an **original ornamental emblem drawn in code** — grapes and Tabor light for the Transfiguration, a bier, mandorla and star for the Dormition, a lily for the Annunciation, tongues of flame for Pentecost, and so on. These are decorations from this companion, labelled as such in the interface; they are never presented as icons. |
| **Memories** | The "My First Dormition Fast in the Orthodox Church" keepsake. |
| **More** | **The prayer corner** — a simple daily-rule shape given by name (Trisagion Prayers, Psalm 50, the day's saints, one's own words) with links to the official GOARCH Digital Chant Stand rather than reprinted texts; the Jesus Prayer with a **prayer-rope counter** (33/50/100, session-only, deliberately never saved — no streaks, no history); a direct link to the **complete official Small Paraklesis text** on the Digital Chant Stand; five psalm suggestions by citation with the Septuagint/Hebrew numbering explained; and listening links (Digital Chant Stand recordings; Ancient Faith as a labelled supplemental source). Reached from the spiritual-focus card on any day. Plus the parish organiser, gentle daily practice tracker, export/import/clear, sources and pastoral note. |

Everything you type is stored in `localStorage` on that one device. Nothing leaves the browser.

---

## Files

```
dormition-fast-companion/
├── index.html                       app shell and all seven sections
├── styles.css                       the whole theme, including print styles
├── app.js                           routing, rendering, storage, service-worker lifecycle
├── manifest.webmanifest             name, icons, theme colours, standalone display
├── sw.js                            offline cache — bump CACHE_VERSION when you edit anything
├── offline.html                     fallback when a navigation fails offline
├── README.md
├── data/
│   ├── calendar-year.json           365 days from the GOARCH Planner. The source of truth.
│   ├── dormition-overlay-2026.json  reflections, prompts and milestones for Aug 1–15 only
│   ├── meals.json                   meal ideas, tags, strict-fast methods, Aug 6 menus
│   └── recipes.json                 15 full recipe cards
├── tools/
│   ├── build-calendar.py            turns a Planner ICS into calendar-year.json
│   └── fetch-icons.sh               downloads two public-domain feast icons
└── assets/
    ├── icons/                       app-icon-192/512, maskable-512, apple-touch, favicon, SVG
    ├── images/                      empty until you run fetch-icons.sh
    └── decorative/                  empty — the ornaments are inline SVG
```

**The two calendar files do different jobs.** `calendar-year.json` holds every designation, saint and reading, straight from GOARCH. `dormition-overlay-2026.json` holds only this app's own reflections, prompts and your family's milestones. The overlay carries no fasting data at all, so the two can never contradict each other.

---

## Local preview

Service workers need `localhost` or HTTPS. Opening `index.html` by double-clicking it will not work — the browser blocks the JSON loads and the app will tell you so.

```bash
cd dormition-fast-companion
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

---

## Publishing to GitHub Pages

1. Create a new GitHub repository, e.g. `dormition-fast-companion`.
2. Upload or push every file, keeping the folder structure exactly as above.
3. Open the repository **Settings**.
4. Open **Pages** in the left sidebar.
5. Under Source, choose **Deploy from a branch**.
6. Choose your branch (`main`) and folder **`/ (root)`**.
7. Click **Save**.
8. Wait a minute, then open the published URL — `https://YOURNAME.github.io/dormition-fast-companion/`.
9. Check the padlock: GitHub Pages serves HTTPS, which the service worker requires.
10. Install it from the browser (below).

Every path in the project is relative, so the subdirectory URL works without changes.

## Installing on iPhone

1. Open the GitHub Pages URL in **Safari** (not Chrome — iOS only installs from Safari).
2. Tap the **Share** button.
3. Scroll and tap **Add to Home Screen**.
4. Confirm the name and tap **Add**.

iOS PWA behaviour varies between versions. The app must be opened from its hosted HTTPS address — a downloaded local HTML file will not get full PWA behaviour or offline caching.

## Installing on Android

1. Open the URL in **Chrome**.
2. Take the install prompt if it appears, or open the ⋮ menu.
3. Tap **Install app** or **Add to Home screen**.

---

## Updating for future years

The Archdiocese publishes a new Planner each September at <https://www.goarch.org/chapel/planner>. When it appears:

1. Download the ZIP and unpack it. You want the English ICS, e.g. `planner2026-en.ics`.
2. Rebuild the calendar:
   ```bash
   python3 tools/build-calendar.py path/to/planner2026-en.ics data/calendar-year.json
   ```
   It prints a summary — day count, date range, a tally of each designation, and the fasting seasons it detected. Glance at it.
3. Update `rangeStart` and `rangeEnd` in `data/dormition-overlay-2026.json` to that year's August dates, and adjust the reflections if you like. Rename the file and the reference in `app.js` if you want to keep the old one.
4. Add any renamed data file to the `SHELL` array in `sw.js`.
5. **Bump `CACHE_VERSION`** in `sw.js` — `dfc-v2` to `dfc-v3`. Nothing updates on installed devices until you do.
6. Deploy, open the app, take the "Update now" banner, then test offline with airplane mode.

The script pulls reading *citations* only. The Planner embeds a full copyrighted English translation of every reading; citations are facts, the translation is not ours to republish. Pass `--with-readings` if you want the full text in a copy you keep for yourself and do not publish.

Weekdays are computed from the ISO date at runtime, so they can never drift out of step with the data.

---

## Adding feast icons

No feast icon ships inside this repository — redistributing someone's photograph of an icon is exactly the thing to avoid. Instead the app has an icon slot on the Feasts screen that loads an image from your own device and stores it there, with the credit and licence you record alongside it.

**The easy path.** From the project root:

```bash
bash tools/fetch-icons.sh
```

That downloads two public-domain files from Wikimedia Commons at 1000px into `assets/images/`. Then open the app → **Feasts** → **Add an icon**, pick the file, and fill in the title, creator and licence when prompted so the attribution travels with the image.

The two files, both by fifteenth-century painters and so long out of copyright:

| Feast | Work | Held by | Commons file | Licence |
|---|---|---|---|---|
| Transfiguration | Icon, c. 1403. Long attributed to Theophanes the Greek; Commons now records the author as unknown. | State Tretyakov Gallery, Moscow | `Transfiguration by Feofan Grek from Spaso-Preobrazhensky Cathedral in Pereslavl-Zalessky (15th c, Tretyakov gallery).jpeg` | Public domain (PD-old / PD-Art) |
| Dormition | *The Dormition of the Virgin*, Andreas Ritzos (Cretan School, c. 1421–1492), tempera on wood | Galleria Sabauda, Turin | `Dormition of Theotokos Andreas Ritzos.jpg` | Public domain (PD-old / PD-Art) |

Three further feast icons are verified and fetched by the same script:

| Feast | Work | Held by | Commons file | Licence |
|---|---|---|---|---|
| Annunciation | The Ustyug Annunciation, Novgorod, c. 1120–1130 | State Tretyakov Gallery, Moscow | `Annunciation ystuj.jpg` | Public domain (life +100, pre-1931 publication — stated on the file page) |
| Nativity of Christ | Icon, 15th c., attributed to Andrei Rublev | Annunciation Cathedral, Moscow Kremlin | `Nativity (15th c., Annunciation Cathedral in Moscow).jpg` | Public domain (15th-c. work, PD-Art) |
| Nativity of the Theotokos | Icon | — | `Nativity of Theotokos.jpg` | Public domain (PD-old-100-expired — stated on the file page) |

A Rublev Ascension (1408, Tretyakov) was confirmed public domain but its exact Commons filename could not be verified from this environment, so it is **not** in the script — better absent than guessed. The same rule kept out everything else: no icon is listed whose match and licence were not both confirmed.

**Check the licence on the Commons file page before you publish anything.** Licences and attributions do change, and PD-Art is a US-centric doctrine — if you are outside the United States, confirm it applies where you are.

If you would rather bake an image into the repository instead of loading it per-device, put it at `assets/images/transfiguration-icon.jpg`, replace the `<div class="icon-frame" data-icon-slot="…">` in `index.html` with an `<img>` carrying real `width`/`height` and descriptive `alt`, add the file to `SHELL` in `sw.js`, bump `CACHE_VERSION`, and record the licence here.

Keep text off the faces and the central figures.

---

## Content sources

**Everything** in `calendar-year.json` — designations, saints, reading citations — is parsed from the **[GOARCH Planner: Ecclesiastical Digital Calendar](https://www.goarch.org/chapel/planner)**, English ICS for September 2025 to August 2026, published by the Greek Orthodox Archdiocese of America. Nothing is inferred, interpolated or pattern-matched. The five designations the Planner uses, verbatim:

| Planner label | Days this year | Meaning |
|---|---|---|
| Strict Fast | 90 | Refrain from meat, fish, oil, wine, dairy, and eggs. |
| Fast Day (Wine and Oil Allowed) | 50 | Wine and oil are allowed. Refrain from meat, fish, dairy, and eggs. |
| Fast Day (Fish Allowed) | 44 | Fish, oil and wine are allowed. Refrain from meat, dairy and eggs. |
| Fast Free | 30 | No fasting restrictions. |
| Fast Day (Dairy, Eggs, and Fish Allowed) | 7 | Dairy, eggs and fish are allowed. Refrain from meat. |
| *(no designation line)* | 144 | An ordinary day. The Online Chapel shows "No fasting restrictions." |

For the record, the Dormition Fast in this year's Planner:

| | | |
|---|---|---|
| Sat Aug 1 | Wine and Oil | Seven Holy Maccabee Children |
| Sun Aug 2 | Wine and Oil | 9th Sunday of Matthew |
| Mon Aug 3 – Wed Aug 5 | Strict Fast | Aug 5 is the Forefeast of the Transfiguration |
| **Thu Aug 6** | **Fish Allowed** | **The Transfiguration** |
| Fri Aug 7 | Strict Fast | Afterfeast |
| Sat Aug 8 – Sun Aug 9 | Wine and Oil | |
| Mon Aug 10 – Thu Aug 13 | Strict Fast | Aug 13 is the Apodosis of the Transfiguration |
| Fri Aug 14 | Strict Fast | Forefeast of the Dormition |
| **Sat Aug 15** | **No fasting restrictions** | **The Dormition of the Theotokos** |

Also used, all GOARCH:

- [Online Chapel calendar](https://www.goarch.org/chapel/calendar) — the same data on the web, and where the full reading text can be read
- [Transfiguration of our Lord](https://www.goarch.org/transfiguration)
- [Dormition of the Theotokos](https://www.goarch.org/dormition)
- [The Calendar of the Orthodox Church](https://www.goarch.org/-/the-calendar-of-the-orthodox-church)

Prayer and chant resources link to the **[GOARCH Digital Chant Stand](https://dcs.goarch.org/)** — including the [complete Small Paraklesis](https://dcs.goarch.org/goa/dcs/p/b/ho/ho23/gr-en/bk.ho.ho23.pdf) and the [daily services index](https://dcs.goarch.org/goa/dcs/servicesindex.html) — and to [Ancient Faith](https://www.ancientfaith.com/), labelled in the app as supplemental. The only prayer text printed in the app is the one-sentence Jesus Prayer; everything else is linked, because service translations are owned by their translators and the wording your parish uses is the wording worth learning.

No OrthodoxWiki, no Wikipedia, no blogs, no social media were used as authority for fasting rules or theology. The reflections, prompts, meal ideas and recipes are this app's own and are **not** from GOARCH — do not mistake them for Archdiocesan material.

## Image licences

| Asset | Source | Licence |
|---|---|---|
| `app-icon-192.png`, `app-icon-512.png`, `maskable-icon-512.png`, `apple-touch-icon.png`, `favicon.png`, `app-icon.svg` | Original, generated for this project | Yours to use and change |
| Three-bar crosses, mandorla frames, ornamental dividers, nav glyphs | Original inline SVG and CSS in `index.html` / `styles.css` | Yours to use and change |
| Feast icons | **None bundled.** Loaded from your device into the app's own storage, or fetched by `tools/fetch-icons.sh` into a folder that is git-ignorable. | See the table above |

No third-party image is redistributed by this repository.

---

## Testing checklist

Verified in a headless Chromium against this build (clock pinned to 6 August 2026):

- [x] Today renders "Thursday, August 6, 2026", designation "Fish, Oil and Wine Allowed", milestone "Holy Chrismation and Holy Baptism"
- [x] Whole-year grid renders August 2026 with 31 tappable cells
- [x] All four fasting seasons detected — Nativity, Great Lent and Holy Week, Apostles', Dormition
- [x] Saint search returns 24 days for "nicholas"
- [x] Strict-fast meal library loads 77 items
- [x] Service worker registers
- [x] Index resolves all 13 Great Feasts, 4 fasting seasons, 4 fast-free weeks, 44 fish days, 90 strict days, 7 dairy days, 23 named Sundays
- [x] Coming up counts down correctly — from 3 August, Transfiguration "in 3 days"
- [x] Starring a meal persists and drives the Favourites chip and the generated plans
- [x] Week planner renders the seven days from today with each day's own designation
- [x] All 13 Great Feast emblems render; the day dialog shows the "Ornament from this companion — not an icon" label
- [x] Prompt selection verified across seasons — a Lenten Sunday shows a Sunday-pool prompt with the companion label
- [x] Index resolves the Paschal cycle (37 milestones), Lenten Sundays (6), Theotokos feasts (7), forefeasts and leavetakings (27), Wed/Fri exceptions (9)
- [x] Pantry filter: 21 chips; "lentils" narrows the strict library to 10 lentil-based meals
- [x] 20 recipes load
- [x] Prayer corner reachable from the Today spiritual-focus card; all five external prayer links resolve to DCS / Ancient Faith
- [x] Rope counter reaches 33 with the completion ring, resets, and is 0 after reload — nothing persists by design
- [x] Year Wheel: 365 rays, 13 feast marks, 2 milestone marks, 12 month labels, 4 season arcs, today needle; ray 340 opens August 7 (correct date mapping); poster print mode isolates the wheel
- [x] Zero console errors across all seven views

Still worth checking yourself after deploying:

- [ ] Weekdays match — Aug 1 Saturday, Aug 6 Thursday, Aug 15 Saturday
- [ ] Manifest loads clean (DevTools → Application → Manifest)
- [ ] Works offline after first load (airplane mode, reopen)
- [ ] Works under the `/dormition-fast-companion/` subpath
- [ ] Notes persist after refresh; export, import and double-confirm clear all behave
- [ ] Calendar cells and the day dialog are reachable and closable by keyboard
- [ ] Print preview readable on US Letter and A4
- [ ] Added icons survive a reload

## Known limitations, stated plainly

- **Reading text is not included** — citations only. The Planner's translation is copyrighted; republishing it on a public page is not something this project should do. `--with-readings` gets you the full text in a private copy.
- **One ecclesiastical year at a time.** September 2025 to August 2026. Rebuild each September; it takes one command.
- **Great Feasts are matched against a curated list** of the Planner's own title wording — all thirteen resolve correctly for this year, and forefeasts and afterfeasts are correctly excluded. If a future Planner rewords a title, that feast would drop out of the index; the build script prints enough to notice. The designation itself is always exact.
- **Season names are inferred** by which anchor dates a run of fasting days contains. The dates are read from the data; only the *label* is this app's. A run can begin a day or two before the canonical start because the preceding Wednesday or Friday is itself a fast day — the app shows the observed run honestly rather than trimming it.
- **No feast icons in the repository.** By design; see above.
- Devotional content works in two layers. The **August 1–15 overlay** is hand-written for this family's journey and always wins. **Every other day** draws from `data/devotional-prompts.json`: small pools of original prompts selected deterministically by rank, then paschal cycle, then fasting season, then the Wednesday/Friday rhythm, then an ordinary-day pool — so a Lenten weekday, a Sunday of Pascha and a random Tuesday in October each get something fitting, and a given date always shows the same prompt. Every prompt is the app's own writing, labelled in the interface as "A prompt from this companion — not a liturgical text." Nothing is quoted from saints, fathers, hymns or services. To deepen the app over the years, add days to the overlay in your own words; the prompt pools are the honest floor, not the ceiling.
- Meal counts: strict fast and wine-and-oil are the deep libraries (77 and 68). Fish (32) and fast-free (18) are thinner; they cover fewer days. Wine-and-oil snacks number 10 rather than the 12 originally asked for.
- 15 recipes, not 20.
- Photographs are not stored — the keepsake fields record *where* your photos live. Icons you add via the Feasts screen are the one exception, and they sit in IndexedDB, which the JSON export does not cover.
- The planner's Plan A and Plan B are generated deterministically from the meal library by tag preference, not hand-curated day by day.
- Journal entries print inside `<textarea>` elements, which some browsers clip to the visible box. For a clean printed journal, export instead.

## Pastoral note

This companion reflects the fasting designations published by the Greek Orthodox Archdiocese of America. Individual fasting practices may be adjusted with the guidance of one's parish priest or spiritual father, particularly for children, pregnancy, illness, medication, demanding work, travel, eating disorders, or other pastoral and medical needs.

Fasting is not merely a dietary program; it belongs within prayer, repentance, worship, almsgiving, and life in Christ.

Nothing in this app is a pastoral ruling. Questions about oil-free cooking, nuts and seeds, shellfish, alcohol, or how to prepare a child for Baptism and first Communion belong with your priest.
