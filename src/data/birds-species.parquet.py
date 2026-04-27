from activate_con import get_db

get_db().execute("""
  COPY (
    SELECT DISTINCT
      "COMMON NAME" AS species
    FROM read_parquet('r2://bird-parquets/month-*.parquet')
    WHERE "COMMON NAME" IS NOT NULL
    ORDER BY species
  ) TO '/dev/stdout' (FORMAT PARQUET)
""")
