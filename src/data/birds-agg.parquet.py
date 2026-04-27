import duckdb
import os
BIN_SIZE = 0.1
con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs;")
con.execute(f"""
    CREATE SECRET (
        TYPE R2,
        KEY_ID '{os.environ["R2_ACCESS_KEY_ID"]}',
        SECRET '{os.environ["R2_SECRET_ACCESS_KEY"]}',
        ACCOUNT_ID '{os.environ["R2_ACCOUNT_ID"]}'
    );
""")
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
