import duckdb

duckdb.execute("""
  COPY (
    SELECT
      "COMMON NAME" AS species,
      "STATE" AS state,
      SUM(
        CASE
          WHEN "OBSERVATION COUNT" = 'X' THEN 1
          ELSE COALESCE(TRY_CAST("OBSERVATION COUNT" AS INTEGER), 1)
        END
      )::INTEGER AS count
    FROM read_parquet('src/data/month-*.parquet')
    WHERE "COMMON NAME" IS NOT NULL
      AND "STATE" IS NOT NULL
    GROUP BY 1, 2
    ORDER BY species, state
  ) TO '/dev/stdout' (FORMAT PARQUET)
""")
