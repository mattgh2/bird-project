from __future__ import annotations

from dataclasses import dataclass

from bird_project.integrations.supabase.client_factory import SupabaseClientFactory
from bird_project.integrations.supabase.settings import SupabaseSettings


@dataclass(slots=True)
class SupabaseRepository:
    factory: SupabaseClientFactory = SupabaseClientFactory()

    def __post_init__(self) -> None:
        self.settings = self.factory.settings

    def client_state(self) -> dict[str, object]:
        client = self.factory.create()
        return {
            "enabled": self.settings.enabled,
            "url": self.settings.url,
            "schema": self.settings.schema,
            "connected": client is not None,
        }

    def insert_placeholder_row(self, table: str, payload: dict[str, object]) -> dict[str, object]:
        client = self.factory.create()
        if client is None:
            return {"inserted": False, "reason": "supabase_disabled"}
        client.table(table).insert(payload).execute()
        return {"inserted": True, "table": table}

