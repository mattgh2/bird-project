from __future__ import annotations

import argparse
import asyncio

from bird_project.application.pipeline import BirdPipeline


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-at", type=int, default=None, help="starting index")
    parser.add_argument("--limit-downloads", type=int, default=None, help="limit number of downloads")
    parser.add_argument("--reset-index", action="store_true", help="Reset the starting index")
    parser.add_argument("--download-fails", action="store_true", help="Retry the failed downloads")
    return parser


def main() -> None:
    pipeline = BirdPipeline()
    args = build_parser().parse_args()

    if args.reset_index:
        pipeline.reset()
        print("Index reset to 0")
        return

    try:
        targets, start_point = pipeline.resolve_targets(
            download_fails=args.download_fails,
            start_at=args.start_at,
        )
    except FileNotFoundError as exc:
        print(exc)
        return
    except ValueError as exc:
        print(exc)
        return

    if start_point >= len(targets):
        print("No more files to process... use --reset-index to begin at index 0")
        return

    limit = len(targets) if args.limit_downloads is None else args.limit_downloads
    print(f"downloading {min(limit, len(targets) - start_point)} files...")
    print(f"starting index is: {start_point}")

    try:
        summary = asyncio.run(
            pipeline.run(
                download_fails=args.download_fails,
                start_at=args.start_at,
                limit_downloads=args.limit_downloads,
            )
        )
    except IndexError as exc:
        print(exc)
        return

    print(f"ending index is {summary.next_index}")
