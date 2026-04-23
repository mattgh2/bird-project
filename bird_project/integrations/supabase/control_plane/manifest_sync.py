from __future__ import annotations

from dataclasses import dataclass, field

from bird_project.integrations.supabase.sync import SupabaseSyncEngine
from bird_project.telemetry.metrics import MetricsRegistry


@dataclass(slots=True)
class ManifestSyncControlPlane:
    engine: SupabaseSyncEngine = field(default_factory=SupabaseSyncEngine)
    metrics: MetricsRegistry = field(default_factory=MetricsRegistry)

    def run_probe(self) -> dict[str, object]:
        self.metrics.counter("supabase.probes").increment()
        return {
            "probe": self.engine.probe(),
            "metrics": self.metrics.export(),
        }

    def run_manifest_sync(self, manifest_size: int) -> dict[str, object]:
        self.metrics.counter("supabase.manifest_syncs").increment()
        return {
            "sync": self.engine.sync_manifest(manifest_size),
            "metrics": self.metrics.export(),
        }

