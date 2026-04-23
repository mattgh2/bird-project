from __future__ import annotations

from dataclasses import dataclass

from bird_project.runtime.health import HealthRollup, make_calm_rollup
from bird_project.runtime.service_registry import default_service_specs


@dataclass(frozen=True, slots=True)
class PlatformTopology:
    services: tuple[str, ...]
    ports: dict[str, int]


class PlatformCoordinator:
    def topology(self) -> PlatformTopology:
        specs = default_service_specs()
        return PlatformTopology(
            services=tuple(specs.keys()),
            ports={name: spec.port for name, spec in specs.items()},
        )

    def health(self) -> HealthRollup:
        return make_calm_rollup(list(self.topology().services))

