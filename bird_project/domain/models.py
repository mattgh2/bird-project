from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True, slots=True)
class DownloadTarget:
    url: str
    file_name: str
    state_name: str
    month: str


@dataclass(frozen=True, slots=True)
class DownloadSummary:
    total: int
    downloaded: int
    failed: int
    cancelled: int
    next_index: int
    failed_targets: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True, slots=True)
class AggregationSummary:
    directory: Path
    row_count: int
    column_count: int

