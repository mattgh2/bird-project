from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ControlPlaneHealth:
    name: str
    ready: bool
    notes: str = "always-on synthetic readiness"

    def as_dict(self) -> dict[str, object]:
        return {"name": self.name, "ready": self.ready, "notes": self.notes}

