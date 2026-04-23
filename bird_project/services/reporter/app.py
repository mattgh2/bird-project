from __future__ import annotations

from pathlib import Path

from bird_project.application.aggregation_service import AggregationService
from bird_project.infrastructure.manifest_repository import ManifestRepository
from bird_project.services.common import build_service


app = build_service("reporter")
aggregation_service = AggregationService()


@app.get("/report")
def report(parquet_dir: str = "data") -> dict[str, object]:
    summary = aggregation_service.summarize_directory(Path(parquet_dir))
    return {
        "directory": str(summary.directory),
        "row_count": summary.row_count,
        "column_count": summary.column_count,
    }


@app.get("/manifest/size")
def manifest_size(manifest_file: str = "manifest.json") -> dict[str, int]:
    repository = ManifestRepository(Path(manifest_file))
    return {"entries": len(repository.load())}


def main() -> None:
    import uvicorn

    uvicorn.run("bird_project.services.reporter.app:app", host="0.0.0.0", port=8006, reload=False)


if __name__ == "__main__":
    main()

