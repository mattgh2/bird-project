from __future__ import annotations

from pathlib import Path

import pyarrow.parquet as pq


class ParquetStore:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def path_for(self, file_name: str) -> Path:
        return self.data_dir / file_name

    def write_table(self, table, file_name: str) -> Path:
        destination = self.path_for(file_name)
        pq.write_table(table, destination)
        return destination

