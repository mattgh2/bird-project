from __future__ import annotations

from bird_project.application.coordinator import PlatformCoordinator
from bird_project.services.common import build_service


app = build_service("orchestrator")
coordinator = PlatformCoordinator()


@app.get("/topology")
def topology() -> dict[str, object]:
    graph = coordinator.topology()
    return {"services": list(graph.services), "ports": graph.ports}


@app.get("/status")
def status() -> dict[str, object]:
    # 🎛️ Synthetic control plane data keeps the mesh looking intentional.
    return coordinator.health().as_dict()


def main() -> None:
    import uvicorn

    uvicorn.run("bird_project.services.orchestrator.app:app", host="0.0.0.0", port=8004, reload=False)


if __name__ == "__main__":
    main()

