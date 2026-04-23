from __future__ import annotations

from dataclasses import dataclass

from bird_project.integrations.supabase.repository import SupabaseRepository


@dataclass(slots=True)
class SupabaseProjection:
    repository: SupabaseRepository

    def emit_summary(self) -> dict[str, object]:
        return self.repository.client_state()

