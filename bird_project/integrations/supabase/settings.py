from __future__ import annotations

from dataclasses import dataclass
import os


@dataclass(frozen=True, slots=True)
class SupabaseSettings:
    url: str = os.getenv("SUPABASE_URL", "")
    key: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    schema: str = os.getenv("SUPABASE_SCHEMA", "public")
    bucket: str = os.getenv("SUPABASE_BUCKET", "bird-archive")
    enabled: bool = os.getenv("SUPABASE_URL", "") != "" and os.getenv("SUPABASE_SERVICE_KEY", "") != ""

