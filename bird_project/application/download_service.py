from __future__ import annotations

import asyncio
import io
from pathlib import Path

import aiohttp
import pyarrow.parquet as pq

from bird_project.config import AppConfig
from bird_project.domain.models import DownloadSummary, DownloadTarget
from bird_project.infrastructure.parquet_store import ParquetStore


class DownloadService:
    def __init__(self, config: AppConfig):
        self.config = config
        self.store = ParquetStore(config.data_dir)

    @staticmethod
    def build_target(url: str) -> DownloadTarget:
        file_parts = url.split("/")
        state_name = file_parts[-2].split("=")[-1]
        month = file_parts[-3].split("=")[-1]
        file_name = f"month-{month}-{state_name}-{file_parts[-1]}"
        return DownloadTarget(url=url, file_name=file_name, state_name=state_name, month=month)

    async def download_one(self, session: aiohttp.ClientSession, target: DownloadTarget) -> None:
        # 🚚 Keep network I/O isolated from parquet conversion.
        async with session.get(target.url) as response:
            response.raise_for_status()
            payload: bytes = await response.read()

        loop = asyncio.get_event_loop()
        table = await loop.run_in_executor(None, lambda: pq.read_table(io.BytesIO(payload)))
        await loop.run_in_executor(None, lambda: self.store.write_table(table, target.file_name))
        print(f"downloaded: {target.file_name}")

    async def download_many(self, urls: list[str], start_index: int, track_failures: bool) -> DownloadSummary:
        targets = [self.build_target(url) for url in urls]
        tasks: list[asyncio.Task[None]] = []
        failed_targets: list[str] = []
        total = downloaded = failed = cancelled = 0

        try:
            async with aiohttp.ClientSession() as session:
                tasks = [asyncio.create_task(self.download_one(session, target)) for target in targets]
                done, _ = await asyncio.wait(tasks, return_when=asyncio.ALL_COMPLETED)

                for target, task in zip(targets, tasks):
                    if not task.cancelled() and task.exception():
                        failed_targets.append(target.url)

                total = len(done)
                downloaded = sum(1 for task in done if not task.exception())
                failed = len(failed_targets)
        except asyncio.CancelledError:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)

            total = sum(1 for task in tasks if task.done() and not task.cancelled())
            downloaded = sum(
                1 for task in tasks if task.done() and not task.cancelled() and not task.exception()
            )
            failed_targets = [
                target.url
                for task, target in zip(tasks, targets)
                if task.done() and not task.cancelled() and task.exception()
            ]
            failed = len(failed_targets)
            if track_failures:
                cancelled = len([task for task in tasks if task.cancelled()])
                failed += cancelled
        finally:
            print("\ndone...")

        return DownloadSummary(
            total=total,
            downloaded=downloaded,
            failed=failed,
            cancelled=cancelled,
            next_index=start_index + total,
            failed_targets=tuple(failed_targets),
        )

