import duckdb

BIN_SIZE = 0.1

duckdb.execute(f"""
  COPY (
    SELECT
      FLOOR("LONGITUDE"::DOUBLE / {BIN_SIZE}) * {BIN_SIZE} + {BIN_SIZE} / 2 AS lng_bin,
      FLOOR("LATITUDE"::DOUBLE / {BIN_SIZE}) * {BIN_SIZE} + {BIN_SIZE} / 2 AS lat_bin,
      EXTRACT(month FROM "OBSERVATION DATE")::INTEGER AS month,
      COUNT(*)::INTEGER AS count,
      AVG(CASE
        WHEN "OBSERVATION COUNT" = 'X' THEN 1
        ELSE COALESCE(TRY_CAST("OBSERVATION COUNT" AS DOUBLE), 1)
      END)::DOUBLE AS avg_flock
    FROM read_parquet('src/data/month-*.parquet')
    WHERE "LONGITUDE" IS NOT NULL
      AND "LATITUDE" IS NOT NULL
      AND "OBSERVATION DATE" IS NOT NULL
    GROUP BY 1, 2, 3
    ORDER BY month, lat_bin, lng_bin
  ) TO '/dev/stdout' (FORMAT PARQUET)
""")

      # "LONGITUDE" AS lng_bin,
      # "LATITUDE" AS lat_bin,
