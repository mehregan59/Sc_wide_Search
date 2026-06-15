# SciWide Search

A free, open-source tool for systematic literature and occurrence-record searches across multiple academic, preprint and biodiversity databases — running entirely in your browser, no backend, no API keys.

**Live app:** https://mehregan59.github.io/Sc_wide_Search

## What it does

- Searches several free, CORS-friendly APIs in parallel: OpenAlex, Europe PMC, Crossref, Zenodo, GBIF, and iNaturalist. (Semantic Scholar is routed through OpenAlex, since Semantic Scholar's own API blocks browser requests.)
- Extracts country, region, host/subject, evidence type and more from each result's title and abstract, using editable keyword lists.
- Classifies every record into categories A–F (primary record, additional sampling location, strain/lab origin, modelling/review, no usable location, pre-1980 historical) and assigns a verification status — a useful starting point for PRISMA-style reporting.
- Lets you customise exactly which fields are collected via the **Schema** tab: rename columns, toggle fields on or off, edit extraction keyword lists, or add entirely new custom fields.
- Tracks every paywalled DOI found and gives one-click links to check Unpaywall, Europe PMC, Google Scholar, and your library's interlibrary-loan service.
- Exports to CSV, JSON, BibTeX, and GeoJSON.

## Presets

Search terms, database selections, filters, schema customisations, and notes on known gaps can be saved as a single JSON **preset** file and reloaded later, or shared with anyone via a download link. Nothing is stored on a server — presets are just files. Anyone can save their own preset under a new name.

A bundled example preset for *Drosophila suzukii* (Spotted Wing Drosophila) lives under `presets/`. Load it from the Configure tab for a fully populated example, or start from the blank default and save your own preset.

## Running it yourself

This is a static site — clone the repo and open `index.html`, or serve the folder with any static file server. No build step, no dependencies.

## Contributing

New database connectors are welcome, provided the API is free and supports CORS from the browser without an API key. See the connector dispatcher in `js/app.js`.

## Creator & citation

Created by **Mehregan Ebrahimi**.

> Ebrahimi, M. (2026). *SciWide Search* [Software]. https://github.com/mehregan59/Sc_wide_Search

## Support

SciWide Search is free and will stay that way. If it saved you time, consider a small donation via the **About** tab in the app — it helps cover the time spent maintaining it and adding new features.

## License

MIT, with a clause reserving the right to release future versions under a commercial license. See [LICENSE](LICENSE).
