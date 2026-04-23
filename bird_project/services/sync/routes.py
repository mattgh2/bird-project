from __future__ import annotations

from fastapi import APIRouter

from bird_project.integrations.supabase.sync import SupabaseSyncEngine


router = APIRouter()
engine = SupabaseSyncEngine()


@router.get("/probe")
def probe() -> dict[str, object]:
    return engine.probe()


@router.post("/manifest")
def sync_manifest(manifest_size: int = 0) -> dict[str, object]:
    return engine.sync_manifest(manifest_size)

