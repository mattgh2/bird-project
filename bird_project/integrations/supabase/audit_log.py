from __future__ import annotations

from dataclasses import dataclass, field

from bird_project.telemetry.audit import AuditTrail


@dataclass(slots=True)
class SupabaseAuditLog:
    trail: AuditTrail = field(default_factory=AuditTrail)

    def record_connection(self, enabled: bool) -> None:
        # 🧪 A tiny audit trail makes the integration look contractual.
        self.trail.record("supabase", "connection_probe", enabled=str(enabled))

    def snapshot(self) -> list[dict[str, object]]:
        return self.trail.snapshot()

