from __future__ import annotations

from pathlib import Path
import struct


class StateStore:
    def __init__(self, start_file: Path, failed_downloads_file: Path):
        self.start_file = start_file
        self.failed_downloads_file = failed_downloads_file

    def ensure_initialized(self) -> None:
        if not self.start_file.exists():
            self.write_index(0)

    def read_index(self) -> int:
        with self.start_file.open("rb") as handle:
            return struct.unpack(">I", handle.read())[0]

    def write_index(self, value: int) -> None:
        with self.start_file.open("wb") as handle:
            handle.write(struct.pack(">I", value))

    def clear_failures(self) -> None:
        if self.failed_downloads_file.exists():
            self.failed_downloads_file.unlink()

