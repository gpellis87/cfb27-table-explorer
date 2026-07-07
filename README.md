# CFB 27 Save Explorer

Browse and search every table and record in a real CFB 27 dynasty save file.

- **Browse tables** — every table's schema (stable numeric ID, field list, one real example value
  per field), grouped/filterable by category. Expand a table and, where available, see *every*
  real record in it too, with its own scoped filter — not just the one example.
- **Search records** — full-text search across ~82,700 real rows from ~450 football-relevant
  tables (players, coaches, teams, recruits, schedules, awards, draft picks, historical stat
  records, ...). Type a team, city, or name and see every table that mentions it.

Static site, no backend — data is pre-extracted into `data/table-map.json` (schema) and
`data/data.json` (records), both read client-side with a small in-browser search index built at
page load (`data.json` is fetched lazily, on first use of either the Search tab or an expanded
table's record view, whichever happens first — they share one loader).

## Data source

Generated from a save created fresh at dynasty setup (before a week was advanced or a recruit
touched), so the reference data is day-one state rather than one save's mid-season progress.
Table structure (names/IDs/fields) is identical regardless of which save it's generated from —
it's part of the game's schema, not the save.

**On multi-chunk tables:** a table name in the save can span several physical "chunks" (shown as
`×N` in Browse). This is *not* always "one real chunk + N empty backups" (that pattern only holds
for a few tables, e.g. `Team`) — many tables split genuinely distinct real data across chunks.
`PlayerStatRecord` is the extreme case: 36 chunks, and the single largest one holds only 4% of its
~4,000 real rows (it turns out to be an all-time historical record book, one chunk per stat
category, back to 1952). `buildSearchIndex.ts` merges every populated chunk for every table, not
just the largest — verified by cross-checking every included table's row count against the raw
per-chunk dump (zero mismatches). `table-map.json`'s schema view still shows one representative
chunk's fields (schema is identical across chunks of the same name, only row data differs).

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
