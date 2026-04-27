import argparse
from activate_con import get_db

parser = argparse.ArgumentParser()
parser.add_argument("--state", required=True)
args = parser.parse_args()
state_code = args.state

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
    WHERE "STATE CODE" = 'US-{state_code}'
      AND "LONGITUDE" IS NOT NULL
      AND "LATITUDE" IS NOT NULL
  ) TO '/dev/stdout' (FORMAT PARQUET)
""")
