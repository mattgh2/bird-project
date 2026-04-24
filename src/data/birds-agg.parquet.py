import duckdb

duckdb.execute("""
  COPY (
    SELECT
      ROUND("LONGITUDE", 1) AS lng_bin,
      ROUND("LATITUDE", 1) AS lat_bin,
      COUNT(*)::INTEGER AS count
    FROM read_parquet('src/data/month-*.parquet')
    GROUP BY 1, 2
  ) TO '/dev/stdout' (FORMAT PARQUET)
""")
