import argparse
import glob
import json
import sys
from pathlib import Path
import duckdb

parser = argparse.ArgumentParser()
parser.add_argument("--state", required=True)
parser.add_argument("--month", required=True)   # "all" or 1-12
parser.add_argument("--day", required=True)     # "all" or 1-31
parser.add_argument("--species", required=True) # "all" or hex-encoded UTF-8 species name
args = parser.parse_args()

state_code = args.state
month = args.month
day = args.day
species_raw = args.species

# Hex-encoded species name avoids URL separator conflicts with hyphens in names
if species_raw != "all":
    try:
        species_name = bytes.fromhex(species_raw).decode("utf-8")
    except Exception:
        species_name = None
else:
    species_name = None

# Try local parquet files first — no network, no R2 credentials needed.
# Files are named month-{N}-US-{STATE}-{chunk}.parquet and already filtered by state.
data_dir = Path(__file__).parent
if month == "all":
    local_pattern = str(data_dir / f"month-*-US-{state_code}-*.parquet")
else:
    local_pattern = str(data_dir / f"month-{month}-US-{state_code}-*.parquet")

use_local = bool(glob.glob(local_pattern))

if use_local:
    con = duckdb.connect()
    source = f"read_parquet('{local_pattern}')"
    # Local files are already state-partitioned; no state filter needed.
    filters = ['"LONGITUDE" IS NOT NULL', '"LATITUDE" IS NOT NULL']
    # OBSERVATION DATE is already a DATE type in local files
    date_extract = 'EXTRACT(DAY FROM "OBSERVATION DATE")'
else:
    from activate_con import get_db
    con = get_db()
    source = "read_parquet('r2://bird-parquets/month-*.parquet')"
    filters = [
        f'"STATE CODE" = \'US-{state_code}\'',
        '"LONGITUDE" IS NOT NULL',
        '"LATITUDE" IS NOT NULL',
    ]
    if month != "all":
        filters.append(f'"obsMonth" = {int(month)}')
    date_extract = 'EXTRACT(DAY FROM "OBSERVATION DATE"::DATE)'

if day != "all":
    filters.append(f"{date_extract} = {int(day)}")
if species_name:
    safe_species = species_name.replace("'", "''")
    filters.append(f'"COMMON NAME" = \'{safe_species}\'')

where_clause = " AND ".join(filters)

no_filter = month == "all" and day == "all" and species_name is None
month_only = month != "all" and day == "all" and species_name is None

if no_filter:
    sample_clause = "USING SAMPLE reservoir(10000 ROWS) REPEATABLE (42)"
elif month_only:
    # Month data can be very large for populous states; cap at 50k for map rendering.
    sample_clause = "USING SAMPLE reservoir(50000 ROWS) REPEATABLE (42)"
else:
    sample_clause = ""

rows = con.execute(f"""
    SELECT
        "LONGITUDE" AS lng,
        "LATITUDE" AS lat,
        "COMMON NAME" AS common_name,
        "SCIENTIFIC NAME" AS scientific_name,
        epoch_ms("OBSERVATION DATE"::DATE) AS observation_date,
        CASE
            WHEN "OBSERVATION COUNT" = 'X' THEN 1
            ELSE COALESCE(TRY_CAST("OBSERVATION COUNT" AS INTEGER), 1)
        END::INTEGER AS observation_count,
        "STATE" AS state,
        "COUNTY" AS county,
        "LOCALITY" AS locality,
        "DURATION MINUTES" AS duration_minutes
    FROM {source}
    WHERE {where_clause}
    {sample_clause}
""").fetchall()

columns = [
    "lng", "lat", "common_name", "scientific_name", "observation_date",
    "observation_count", "state", "county", "locality", "duration_minutes",
]
json.dump([dict(zip(columns, row)) for row in rows], sys.stdout)
