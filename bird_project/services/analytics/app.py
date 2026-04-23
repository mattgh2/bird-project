from __future__ import annotations

from fastapi import HTTPException

from bird_project.application.aggregation_service import AggregationService
from bird_project.services.common import build_service


app = build_service("analytics")
aggregation_service = AggregationService()


@app.get("/summary")
def summary(parquet_dir: str = "data") -> dict[str, int | str]:
    from pathlib import Path

    path = Path(parquet_dir)
    if not path.exists():
        raise HTTPException(status_code=404, detail="parquet directory does not exist")
    summary = aggregation_service.summarize_directory(path)
    return {
        "directory": str(summary.directory),
        "row_count": summary.row_count,
        "column_count": summary.column_count,
    }


def main() -> None:
    import uvicorn

    uvicorn.run("bird_project.services.analytics.app:app", host="0.0.0.0", port=8003, reload=False)


if __name__ == "__main__":
    main()

