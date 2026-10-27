# Manual steps (things only a human can do)

Everything else is automated. Do these in order; each says exactly where files go.

## 1. Accounts and credentials

| # | What | Where | Put it in |
|---|---|---|---|
| 1.1 | **Vercel** account and project linked to this GitHub repo | https://vercel.com/new | — |
| 1.2 | **Neon Postgres** via Vercel Marketplace (Storage → Create → Neon). Vercel injects `DATABASE_URL`. | Vercel project → Storage | Vercel env (automatic) |
| 1.3 | **Copernicus Data Space** account, then an OAuth client (Sentinel Hub) | https://dataspace.copernicus.eu → https://shapps.dataspace.copernicus.eu/dashboard/#/account/settings → "OAuth clients" → Create | `CDSE_CLIENT_ID`, `CDSE_CLIENT_SECRET` |
| 1.4 | **Telegram bot**: talk to @BotFather, `/newbot`, copy the token and username | Telegram app | `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` |
| 1.5 | Random secrets: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` three times | terminal | `SESSION_SECRET`, `CRON_SECRET`, `TELEGRAM_WEBHOOK_SECRET` |
| 1.6 | Officer passcode (long, random) | — | `ADMIN_PASSCODE` |
| 1.7 | Public URL after first deploy | Vercel | `NEXT_PUBLIC_SITE_URL` |

## 2. Datasets that need a login or were unreachable from the build machine

### 2.1 ICRISAT District Level Database (irrigated area) — **needed for the third stress component**
1. Register (free) at http://data.icrisat.org/dld/ and log in.
2. Download the **apportioned** district data (2011 district boundaries) for *Land Use / Irrigated Area by Crop* and *Area* tables, all states, all years, as CSV.
3. Save the CSV(s) into `data/raw/icrisat/` (any file name ending in `.csv` or `.xlsx`).
4. Run `python -m pipeline.run_all`, then `npm run db:load`.
5. Open `data/prepared/VALIDATION_REPORT.md` → section *Irrigation*: if it lists unmatched ICRISAT district names, add rows to `data/reference/district_aliases.csv` with `source=icrisat`.

### 2.2 IMD 0.25° gridded rainfall (true district rainfall instead of subdivision values)
On a machine that can reach imdpune.gov.in:
```bash
source .venv/bin/activate
python - <<'EOF'
import imdlib
imdlib.get_data("rain", 1981, 2025, fn_format="yearwise", file_dir="data/raw/imd")
EOF
```
This writes `data/raw/imd/rain/<year>.grd`; move or symlink them to `data/raw/imd/grid/<year>.grd`. Then `python -m pipeline.run_all` (the report will show basis `imd_grid_district`) and `npm run db:load`.

### 2.3 District NDVI (Atlas NDVI layer)
On a machine that can reach planetarycomputer.microsoft.com (takes ~1–3 min per district-year):
```bash
python -m pipeline.ndvi --states KA --start 2024-01 --end 2025-12
python -m pipeline.run_all && npm run db:load
```

### 2.4 Check the FAO-56 transcription
Open FAO-56 (https://www.fao.org/4/x0490e/x0490e00.htm) Tables 11, 12, 19 and 22 and confirm every number in `data/reference/fao56_crops.csv` and `soil_types.csv`. In particular confirm the Table 11 rows chosen for wheat ("Central India, Nov") and maize ("India, Oct dry season"). If a value differs, fix it in **both** the CSV and `lib/agro/reference.ts` (a unit test checks they match).

## 3. Native-speaker review (before the demo)

All Hindi (`lib/i18n/hi.ts`) and Kannada (`lib/i18n/kn.ts`) strings were written by the developer, not by native speakers, and not machine-translated at runtime. Ask a native speaker of each language to review, at minimum:
- `advice.*` (the advisory card text farmers will read and hear),
- `field.*` (the four-step flow),
- `telegram.*` (bot messages),
- `journey.*` captions.
Mark reviewed files with the reviewer's name in a comment at the top.

## 4. Deployment wiring (see docs/DEPLOY.md for the full sequence)

1. Add all env vars from `.env.example` in Vercel (Production + Preview).
2. `DATABASE_URL=… npm run db:migrate && DATABASE_URL=… npm run db:load` from your machine (loads `data/prepared/*.csv` into Neon).
3. Deploy, then `npm run telegram:set-webhook` with `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` and `NEXT_PUBLIC_SITE_URL` set.
4. Vercel → Settings → Cron Jobs: confirm `/api/cron/daily-advisories` is listed (from `vercel.json`).

## 5. Optional

- **Tableau Public live advisories**: create a Google Cloud service account with Sheets API, share a Google Sheet with it, put its JSON key in `GOOGLE_SERVICE_ACCOUNT_JSON` and the sheet id in `ADVISORIES_SHEET_ID`, then enable `.github/workflows/advisories-to-sheet.yml` (see TABLEAU_GUIDE).
- **TTS voice notes on Telegram**: set `TTS_API_KEY` (see DECISIONS: provider choice).
