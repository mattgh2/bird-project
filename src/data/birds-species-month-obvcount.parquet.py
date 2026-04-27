from activate_con import get_db

get_db().execute("""
  COPY (
    SELECT
      "COMMON NAME" AS species,
      EXTRACT(month FROM "OBSERVATION DATE")::INTEGER AS month,
      SUM(
        CASE
          WHEN "OBSERVATION COUNT" = 'X' THEN 1
          ELSE COALESCE(TRY_CAST("OBSERVATION COUNT" AS INTEGER), 1)
        END
      )::INTEGER AS observation_count
    FROM read_parquet('r2://bird-parquets/month-*.parquet')
    WHERE "COMMON NAME" IS NOT NULL
      AND "OBSERVATION DATE" IS NOT NULL
    GROUP BY 1, 2
    ORDER BY species, month
  ) TO '/dev/stdout' (FORMAT PARQUET)
""")
