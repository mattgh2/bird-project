from __future__ import annotations

import json
import re
from pathlib import Path


class ManifestRepository:
    def __init__(self, manifest_file: Path):
        self._manifest_file = manifest_file

    def load(self) -> list[str]:
        with self._manifest_file.open("r") as handle:
            manifest = json.load(handle)
        return [item for item in manifest if isinstance(item, str)]

    def load_us_targets(self) -> list[str]:
        return [item for item in self.load() if re.search(r"US-.+", item)]

