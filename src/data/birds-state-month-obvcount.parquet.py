import duckdb

duckdb.execute("""
  COPY (
    SELECT
      "STATE" AS state,
      EXTRACT(month FROM "OBSERVATION DATE")::INTEGER AS month,
      SUM(
        CASE
          WHEN "OBSERVATION COUNT" = 'X' THEN 1
          ELSE COALESCE(TRY_CAST("OBSERVATION COUNT" AS INTEGER), 1)
        END
      )::INTEGER AS observation_count
    FROM read_parquet('src/data/month-*.parquet')
    WHERE "STATE" IS NOT NULL
      AND "OBSERVATION DATE" IS NOT NULL
    GROUP BY 1, 2
    ORDER BY state, month
  ) TO '/dev/stdout' (FORMAT PARQUET)
""")
