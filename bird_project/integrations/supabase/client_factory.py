from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from bird_project.integrations.supabase.settings import SupabaseSettings


class SupabaseClientFactory:
    def __init__(self, settings: SupabaseSettings | None = None):
        self.settings = settings or SupabaseSettings()

    @lru_cache(maxsize=1)
    def create(self) -> Client | None:
        if not self.settings.enabled:
            return None
        return create_client(self.settings.url, self.settings.key)

