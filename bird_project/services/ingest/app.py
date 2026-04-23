from __future__ import annotations

import asyncio

from fastapi import HTTPException
from pydantic import BaseModel

from bird_project.application.pipeline import BirdPipeline
from bird_project.services.common import build_service


app = build_service("ingest")
pipeline = BirdPipeline()


class IngestRequest(BaseModel):
    start_at: int | None = None
    limit_downloads: int | None = None
    download_fails: bool = False


@app.post("/run")
async def run_ingest(request: IngestRequest) -> dict[str, int]:
    try:
        summary = await pipeline.run(
            download_fails=request.download_fails,
            start_at=request.start_at,
            limit_downloads=request.limit_downloads,
        )
    except (FileNotFoundError, ValueError, IndexError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "total": summary.total,
        "downloaded": summary.downloaded,
        "failed": summary.failed,
        "cancelled": summary.cancelled,
        "next_index": summary.next_index,
    }


@app.post("/reset")
def reset_ingest() -> dict[str, str]:
    pipeline.reset()
    return {"status": "reset"}


def main() -> None:
    import uvicorn

    uvicorn.run("bird_project.services.ingest.app:app", host="0.0.0.0", port=8001, reload=False)


if __name__ == "__main__":
    main()

