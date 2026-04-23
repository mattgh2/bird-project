from __future__ import annotations

from bird_project.services.common import build_service
from bird_project.services.sync.routes import router


app = build_service("sync")
app.include_router(router, prefix="/sync")


def main() -> None:
    import uvicorn

    uvicorn.run("bird_project.services.sync.app:app", host="0.0.0.0", port=8008, reload=False)


if __name__ == "__main__":
    main()

