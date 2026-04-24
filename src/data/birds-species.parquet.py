import duckdb

duckdb.execute("""
  COPY (
    SELECT DISTINCT
      "COMMON NAME" AS species
    FROM read_parquet('src/data/month-*.parquet')
    WHERE "COMMON NAME" IS NOT NULL
    ORDER BY species
  ) TO '/dev/stdout' (FORMAT PARQUET)
""")
