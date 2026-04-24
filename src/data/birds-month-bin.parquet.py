import duckdb

duckdb.execute("""
  COPY (
    SELECT
      ROUND("LONGITUDE"::DOUBLE, 1) AS lng_bin,
      ROUND("LATITUDE"::DOUBLE, 1) AS lat_bin,
      COUNT(*)::INTEGER AS count,
      EXTRACT(month FROM "OBSERVATION DATE")::INTEGER AS month
    FROM read_parquet('src/data/month-*.parquet')
    WHERE "LONGITUDE" IS NOT NULL
      AND "LATITUDE" IS NOT NULL
      AND "OBSERVATION DATE" IS NOT NULL
    GROUP BY 1, 2, 4
    ORDER BY month, lat_bin, lng_bin
  ) TO '/dev/stdout' (FORMAT PARQUET)
""")
