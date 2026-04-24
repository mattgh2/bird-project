import duckdb

duckdb.execute("""
  COPY (
    SELECT
      "COMMON NAME" AS common_name,
      "OBSERVATION COUNT" AS observation_count,
      "SCIENTIFIC NAME" AS scientific_name,
      "SUBSPECIES COMMON NAME" AS subspecies_common_name,
      "SUBSPECIES SCIENTIFIC NAME" AS subspecies_scientific_name,
      NULL AS age,
      NULL AS sex,
      "COUNTRY" AS country,
      "STATE" AS state,
      "COUNTY" AS county,
      "LOCALITY" AS locality,
      "LONGITUDE" AS lng,
      "LATITUDE" AS lat,
      "OBSERVATION DATE" AS observation_date,
      "DURATION MINUTES" AS duration_minutes
    FROM read_parquet('src/data/month-*.parquet')
    USING SAMPLE 100000 ROWS (reservoir, 42)
  ) TO '/dev/stdout' (FORMAT PARQUET)
""")
