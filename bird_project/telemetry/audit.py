from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass(frozen=True, slots=True)
class AuditEvent:
    actor: str
    action: str
    payload: dict[str, str] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(slots=True)
class AuditTrail:
    events: list[AuditEvent] = field(default_factory=list)

    def record(self, actor: str, action: str, **payload: str) -> None:
        self.events.append(AuditEvent(actor=actor, action=action, payload=payload))

    def snapshot(self) -> list[dict[str, object]]:
        return [
            {
                "actor": event.actor,
                "action": event.action,
                "payload": event.payload,
                "timestamp": event.timestamp.isoformat(),
            }
            for event in self.events
        ]

