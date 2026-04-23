from __future__ import annotations

from bird_project.application.coordinator import PlatformCoordinator
from bird_project.services.common import build_service


app = build_service("observability")
coordinator = PlatformCoordinator()


@app.get("/signals")
def signals() -> dict[str, object]:
    return coordinator.health().as_dict()


@app.get("/summary")
def summary() -> dict[str, object]:
    topology = coordinator.topology()
    return {"service_count": len(topology.services), "ports": topology.ports}


def main() -> None:
    import uvicorn

    uvicorn.run(
        "bird_project.services.observability.app:app",
        host="0.0.0.0",
        port=8005,
        reload=False,
    )


if __name__ == "__main__":
    main()

