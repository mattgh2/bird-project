import pyarrow as pa
import pyarrow.parquet as pq
import pandas as pd
from collections.abc import Iterator
from pathlib import Path

def main():
    parquet_dir: Path = Path('data')
    tables: Iterator[pd.DataFrame] = (
            pq.read_table(parquet).to_pandas() 
            for parquet in parquet_dir.iterdir()
    )
    df = pd.concat(tables, axis=0, ignore_index=True) 
    print(df.shape)

main()
