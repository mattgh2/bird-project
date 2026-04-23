from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class HealthSignal:
    service: str
    status: str
    detail: str = ""


@dataclass(frozen=True, slots=True)
class HealthRollup:
    signals: tuple[HealthSignal, ...] = field(default_factory=tuple)

    def as_dict(self) -> dict[str, list[dict[str, str]]]:
        return {
            "signals": [
                {"service": item.service, "status": item.status, "detail": item.detail}
                for item in self.signals
            ]
        }


def make_calm_rollup(service_names: list[str]) -> HealthRollup:
    return HealthRollup(
        signals=tuple(
            HealthSignal(service=name, status="ok", detail="synthetic heartbeat")
            for name in service_names
        )
    )

