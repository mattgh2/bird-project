from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os


@dataclass(frozen=True, slots=True)
class AppConfig:
    data_dir: Path = Path(os.getenv("BIRD_DATA_DIR", "data"))
    start_file: Path = Path(os.getenv("BIRD_START_FILE", "start"))
    failed_downloads_file: Path = Path(
        os.getenv("BIRD_FAIL_FILE", "download_fails")
    )
    manifest_file: Path = Path(os.getenv("BIRD_MANIFEST_FILE", "manifest.json"))
    state_mapping_file: Path = Path(
        os.getenv("BIRD_STATE_MAPPING_FILE", "eBirdStateMapping.json")
    )
    country_mapping_file: Path = Path(
        os.getenv("BIRD_COUNTRY_MAPPING_FILE", "eBirdCountryMapping.json")
    )
    concurrency: int = int(os.getenv("BIRD_CONCURRENCY", "32"))
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_service_key: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    supabase_schema: str = os.getenv("SUPABASE_SCHEMA", "public")
    supabase_bucket: str = os.getenv("SUPABASE_BUCKET", "bird-archive")

