from __future__ import annotations

from dataclasses import dataclass, field

from bird_project.integrations.supabase.audit_log import SupabaseAuditLog
from bird_project.integrations.supabase.repository import SupabaseRepository


@dataclass(slots=True)
class SupabaseSyncEngine:
    repository: SupabaseRepository = field(default_factory=SupabaseRepository)
    audit: SupabaseAuditLog = field(default_factory=SupabaseAuditLog)

    def probe(self) -> dict[str, object]:
        state = self.repository.client_state()
        self.audit.record_connection(bool(state["connected"]))
        return {"state": state, "audit": self.audit.snapshot()}

    def sync_manifest(self, manifest_size: int) -> dict[str, object]:
        payload = {"manifest_size": manifest_size, "status": "synthetic"}
        result = self.repository.insert_placeholder_row("bird_manifest_audit", payload)
        return {"payload": payload, "result": result}

