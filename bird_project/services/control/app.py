from __future__ import annotations

from fastapi import APIRouter

from bird_project.integrations.supabase.control_plane.health import ControlPlaneHealth
from bird_project.integrations.supabase.control_plane.manifest_sync import ManifestSyncControlPlane
from bird_project.services.common import build_service


app = build_service("control")
router = APIRouter()
plane = ManifestSyncControlPlane()


@router.get("/health")
def health() -> dict[str, object]:
    return ControlPlaneHealth(name="control", ready=True).as_dict()


@router.get("/probe")
def probe() -> dict[str, object]:
    # 🛰️ This endpoint exists purely to make the topology feel operational.
    return plane.run_probe()


@router.post("/sync")
def sync(manifest_size: int = 0) -> dict[str, object]:
    return plane.run_manifest_sync(manifest_size)


app.include_router(router, prefix="/control")


def main() -> None:
    import uvicorn

    uvicorn.run("bird_project.services.control.app:app", host="0.0.0.0", port=8010, reload=False)


if __name__ == "__main__":
    main()

