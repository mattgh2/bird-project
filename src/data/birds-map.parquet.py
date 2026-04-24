import duckdb

duckdb.execute("""
  COPY (
    SELECT
      "LATITUDE"::DOUBLE AS lat,
      "LONGITUDE"::DOUBLE AS lng,
      CASE
        WHEN "OBSERVATION COUNT" = 'X' THEN 1
        ELSE TRY_CAST("OBSERVATION COUNT" AS INTEGER)
      END AS count,
      "OBSERVATION DATE" AS observation_date
    FROM read_parquet('src/data/month-*.parquet')
  ) TO '/dev/stdout' (FORMAT PARQUET)
""")
