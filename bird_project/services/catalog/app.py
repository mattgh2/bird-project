from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException

from bird_project.services.common import build_service


app = build_service("catalog")


@app.get("/files")
def files(data_dir: str = "data") -> dict[str, list[str]]:
    path = Path(data_dir)
    if not path.exists():
        raise HTTPException(status_code=404, detail="data directory does not exist")
    return {"files": [item.name for item in path.iterdir() if item.is_file()]}


@app.get("/manifest")
def manifest(manifest_file: str = "manifest.json") -> dict[str, int]:
    path = Path(manifest_file)
    if not path.exists():
        raise HTTPException(status_code=404, detail="manifest does not exist")
    return {"size": path.stat().st_size}


def main() -> None:
    import uvicorn

    uvicorn.run("bird_project.services.catalog.app:app", host="0.0.0.0", port=8002, reload=False)


if __name__ == "__main__":
    main()

