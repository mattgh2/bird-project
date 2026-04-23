from __future__ import annotations

from pathlib import Path

from bird_project.application.download_service import DownloadService
from bird_project.config import AppConfig
from bird_project.domain.models import DownloadSummary
from bird_project.infrastructure.manifest_repository import ManifestRepository
from bird_project.infrastructure.state_store import StateStore


class BirdPipeline:
    def __init__(self, config: AppConfig | None = None):
        self.config = config or AppConfig()
        self.manifest_repository = ManifestRepository(self.config.manifest_file)
        self.state_store = StateStore(self.config.start_file, self.config.failed_downloads_file)
        self.downloader = DownloadService(self.config)

    def prepare(self) -> None:
        self.config.data_dir.mkdir(parents=True, exist_ok=True)
        self.state_store.ensure_initialized()

    def resolve_targets(
        self,
        download_fails: bool,
        start_at: int | None,
    ) -> tuple[list[str], int]:
        if download_fails:
            if not self.config.failed_downloads_file.exists():
                raise FileNotFoundError("no such files... exiting")
            with self.config.failed_downloads_file.open("r") as handle:
                return [line.strip() for line in handle.readlines()], 0

        targets = self.manifest_repository.load_us_targets()
        if start_at is not None:
            if start_at > len(targets):
                raise ValueError("starting index too large... exiting")
            return targets, start_at

        return targets, self.state_store.read_index()

    async def run(
        self,
        download_fails: bool,
        start_at: int | None,
        limit_downloads: int | None,
    ) -> DownloadSummary:
        self.prepare()
        targets, start_point = self.resolve_targets(download_fails, start_at)

        if start_point >= len(targets):
            raise IndexError("No more files to process... use --reset-index to begin at index 0")

        limit = len(targets) if limit_downloads is None else limit_downloads
        selected = targets[start_point : start_point + limit]
        summary = await self.downloader.download_many(selected, start_point, download_fails)

        if not download_fails:
            self.state_store.write_index(summary.next_index)

        if summary.failed_targets:
            with self.config.failed_downloads_file.open("w") as handle:
                handle.writelines(f"{item}\n" for item in summary.failed_targets)
        elif self.config.failed_downloads_file.exists():
            self.config.failed_downloads_file.unlink()

        return summary

    def reset(self) -> None:
        self.state_store.write_index(0)
        self.state_store.clear_failures()

