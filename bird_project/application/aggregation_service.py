from __future__ import annotations

from pathlib import Path
from collections.abc import Iterator

import pandas as pd
import pyarrow.parquet as pq

from bird_project.domain.models import AggregationSummary


class AggregationService:
    def summarize_directory(self, parquet_dir: Path) -> AggregationSummary:
        tables: Iterator[pd.DataFrame] = (
            pq.read_table(parquet).to_pandas()
            for parquet in parquet_dir.iterdir()
            if parquet.is_file()
        )
        df = pd.concat(tables, axis=0, ignore_index=True)
        return AggregationSummary(
            directory=parquet_dir,
            row_count=df.shape[0],
            column_count=df.shape[1],
        )

