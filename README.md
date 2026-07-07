# CFB 27 Save Explorer

Browse and search every table and record in a real CFB 27 dynasty save file.

- **Browse tables** — every table's schema: stable numeric ID, field list, one real example value
  per field, grouped/filterable by category.
- **Search records** — full-text search across ~78,000 real rows from ~450 football-relevant
  tables (players, coaches, teams, recruits, schedules, awards, draft picks, ...). Type a team,
  city, or name and see every table that mentions it.

Static site, no backend — data is pre-extracted into `data/table-map.json` (schema) and
`data/data.json` (records), both read client-side with a small in-browser search index built at
page load.

## Data source

Generated from a save created fresh at dynasty setup (before a week was advanced or a recruit
touched), so the reference data is day-one state rather than one save's mid-season progress.
Table structure (names/IDs/fields) is identical regardless of which save it's generated from —
it's part of the game's schema, not the save.

## Regenerating the data

The extraction scripts live in the `cfb27-recruiting-lab` project (they need
`madden-franchise` + the CFB27 schema pack already set up there):

```
npx tsx scripts/mapTables.ts "<path to a save file>"        # -> docs/table-map.json
npx tsx scripts/buildSearchIndex.ts "<path to a save file>" "<path to this repo>/data"
```

Then copy `docs/table-map.json` here as `data/table-map.json` (minified) and commit both.

## Tech

Plain HTML/CSS/JS, no build step, no framework, no dependencies. Deploy target: Vercel (static),
GitHub for source.
