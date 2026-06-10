# Sc_wide_Search —  Global Record Collector

A static web application for systematically collecting, extracting, and structuring global occurrence.

**Live app:** https://mehregan59.github.io/Sc_wide_Search

---

## Features

- Multilingual search across 20+ databases in parallel
- No build step — pure HTML/CSS/JS, deploys instantly via GitHub Pages
- Real API connectors: Semantic Scholar, OpenAlex, Europe PMC, Crossref, GBIF, iNaturalist, Zenodo
- Mid-run control — inject new terms, extend year range, add databases without restarting
- One row per source-location combination, 21 fields per record
- Six output categories (A–F) per the full search protocol
- Export to CSV, JSON, BibTeX, GeoJSON, missing-sources TXT

---

## Quick start

### GitHub Pages
1. Go to **Settings → Pages → Source → main branch / root**
2. App is live at `https://mehregan59.github.io/Sc_wide_Search`

### Local
```bash
git clone https://github.com/mehregan59/Sc_wide_Search.git
cd Sc_wide_Search
python3 -m http.server 8080
# Visit http://localhost:8080
```

---

## File structure

```
Sc_wide_Search/
├── index.html
├── css/style.css
├── js/
│   ├── config.js       Schema, constants, settings
│   ├── engines.js      API connectors
│   ├── extractor.js    Location extraction & classification
│   ├── export.js       CSV / JSON / BibTeX / GeoJSON
│   └── app.js          Orchestrator & UI
└── README.md
```

---

## API connectors

| Database | Status |
|---|---|
| Semantic Scholar | ✅ Live |
| OpenAlex | ✅ Live |
| Europe PMC | ✅ Live |
| Crossref | ✅ Live |
| GBIF | ✅ Live |
| iNaturalist | ✅ Live |
| Zenodo | ✅ Live |
| EPPO, CABI, USDA, NARO, CAAS, RDA, BOLD, NCBI | 🔧 Stub — see `js/engines.js` |

---

## Output categories

| Cat. | Description |
|---|---|
| A | Primary records — original collection, trapping, detection |
| B | Sampling locations — confirmed presence |
| C | Lab / experimental strain origin |
| D | Reviews and models with secondary geo info |
| E | No extractable location data |
| F | Pre-1980 historical records |

---

## Licence

MIT
