import argparse
from activate_con import get_db

parser = argparse.ArgumentParser()
parser.add_argument("--state", required=True)
parser.add_argument("--month", required=True)  # "all" or 1-12
parser.add_argument("--day", required=True)    # "all" or 1-31
args = parser.parse_args()

state_code = args.state
month = args.month
day = args.day

filters = [
    f'"STATE CODE" = \'US-{state_code}\'',
    '"LONGITUDE" IS NOT NULL',
    '"LATITUDE" IS NOT NULL',
]
if month != "all":
    filters.append(f'"obsMonth" = {int(month)}')
if day != "all":
    filters.append(f'EXTRACT(DAY FROM "OBSERVATION DATE"::DATE) = {int(day)}')

where_clause = " AND ".join(filters)

con = get_db()
con.execute(f"""
  COPY (
    SELECT
      "LONGITUDE"::DOUBLE AS lng,
      "LATITUDE"::DOUBLE AS lat,
      "COMMON NAME" AS common_name,
      "OBSERVATION DATE"::VARCHAR AS observation_date,
      CASE
        WHEN "OBSERVATION COUNT" = 'X' THEN 1
        ELSE COALESCE(TRY_CAST("OBSERVATION COUNT" AS INTEGER), 1)
      END::INTEGER AS observation_count
    FROM read_parquet('r2://bird-parquets/month-*.parquet')
    WHERE {where_clause}
  ) TO '/dev/stdout' (FORMAT PARQUET)
""")
