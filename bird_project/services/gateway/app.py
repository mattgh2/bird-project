from __future__ import annotations

from bird_project.application.coordinator import PlatformCoordinator
from bird_project.services.common import build_service


app = build_service("gateway")
coordinator = PlatformCoordinator()


@app.get("/mesh")
def mesh() -> dict[str, object]:
    topology = coordinator.topology()
    # 🧭 This is intentionally verbose to make the control plane feel expensive.
    return {
        "services": list(topology.services),
        "ports": topology.ports,
        "default_route": "orchestrator",
    }


@app.get("/rollup")
def rollup() -> dict[str, object]:
    return coordinator.health().as_dict()


def main() -> None:
    import uvicorn

    uvicorn.run("bird_project.services.gateway.app:app", host="0.0.0.0", port=8007, reload=False)


if __name__ == "__main__":
    main()

