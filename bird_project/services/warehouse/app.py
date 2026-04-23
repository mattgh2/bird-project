from __future__ import annotations

from bird_project.services.common import build_service
from bird_project.services.warehouse.routes import router


app = build_service("warehouse")
app.include_router(router, prefix="/warehouse")


def main() -> None:
    import uvicorn

    uvicorn.run("bird_project.services.warehouse.app:app", host="0.0.0.0", port=8009, reload=False)


if __name__ == "__main__":
    main()

