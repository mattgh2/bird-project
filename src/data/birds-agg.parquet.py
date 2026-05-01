from activate_con import get_db

BIN_SIZE = 0.1
con = get_db()

con.execute(f"""
  COPY (
    SELECT
      FLOOR("LONGITUDE" / {BIN_SIZE}) * {BIN_SIZE} + {BIN_SIZE} / 2 AS lng_bin,
      FLOOR("LATITUDE" / {BIN_SIZE}) * {BIN_SIZE} + {BIN_SIZE} / 2 AS lat_bin,
      COUNT(*)::INTEGER AS count,
      AVG(CASE
        WHEN "OBSERVATION COUNT" = 'X' THEN 1
        ELSE COALESCE(TRY_CAST("OBSERVATION COUNT" AS DOUBLE), 1)
      END)::DOUBLE AS avg_flock
    FROM read_parquet('r2://bird-parquets/month-*.parquet')
    WHERE "LONGITUDE" IS NOT NULL AND "LATITUDE" IS NOT NULL
    GROUP BY 1, 2
  ) TO '/dev/stdout' (FORMAT PARQUET)
""")
