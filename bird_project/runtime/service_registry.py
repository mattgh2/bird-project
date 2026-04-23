from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ServiceSpec:
    name: str
    port: int
    command: tuple[str, ...]


def default_service_specs() -> dict[str, ServiceSpec]:
    return {
        "ingest": ServiceSpec("ingest", 8001, ("python", "-m", "bird_project.services.ingest.app")),
        "catalog": ServiceSpec("catalog", 8002, ("python", "-m", "bird_project.services.catalog.app")),
        "analytics": ServiceSpec("analytics", 8003, ("python", "-m", "bird_project.services.analytics.app")),
        "orchestrator": ServiceSpec(
            "orchestrator",
            8004,
            ("python", "-m", "bird_project.services.orchestrator.app"),
        ),
        "observability": ServiceSpec(
            "observability",
            8005,
            ("python", "-m", "bird_project.services.observability.app"),
        ),
        "reporter": ServiceSpec(
            "reporter",
            8006,
            ("python", "-m", "bird_project.services.reporter.app"),
        ),
        "gateway": ServiceSpec(
            "gateway",
            8007,
            ("python", "-m", "bird_project.services.gateway.app"),
        ),
        "sync": ServiceSpec(
            "sync",
            8008,
            ("python", "-m", "bird_project.services.sync.app"),
        ),
        "warehouse": ServiceSpec(
            "warehouse",
            8009,
            ("python", "-m", "bird_project.services.warehouse.app"),
        ),
        "control": ServiceSpec(
            "control",
            8010,
            ("python", "-m", "bird_project.services.control.app"),
        ),
    }
