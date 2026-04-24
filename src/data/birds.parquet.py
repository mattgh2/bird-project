import duckdb

duckdb.execute("""
  COPY (
    SELECT ROUND(LATITUDE, 1) AS lat, ROUND(LONGITUDE, 1) AS lng, COUNT(*)::INTEGER AS count
    FROM read_parquet('src/data/month-*.parquet')
    GROUP BY lat, lng
  ) TO '/dev/stdout' (FORMAT PARQUET)
""")
