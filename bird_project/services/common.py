from __future__ import annotations

from fastapi import FastAPI


def build_service(name: str) -> FastAPI:
    app = FastAPI(title=f"Bird {name}", version="1.0.0")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"service": name, "status": "ok"}

    @app.get("/meta")
    def meta() -> dict[str, str]:
        return {"service": name, "surface": "microservice"}

    return app

