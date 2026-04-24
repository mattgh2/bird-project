import json
import pyarrow.parquet as pq
import io
import aiohttp
import asyncio
import re
from os import remove
import struct
from pathlib import Path
from argparse import ArgumentParser

data_dir = "data"

async def download_parquet(session: aiohttp.ClientSession, url: str):
    file_parts = url.split('/')
    state_name: str = file_parts[-2].split('=')[-1]
    month: str = file_parts[-3].split('=')[-1]
    file_name: str = f"month-{month}-" + state_name + "-" + file_parts[-1]
    try:
        async with session.get(url) as response:
            response.raise_for_status()
            data: bytes = await response.read()
    except aiohttp.ClientResponseError as e:
        print(f"failed {state_name}: {e.status} {e.message}")
        raise
    except Exception as e:
        print(f"failed {state_name}: {e}")
        raise
    loop = asyncio.get_event_loop()
    table = await loop.run_in_executor(None, lambda: pq.read_table(io.BytesIO(data)))
    await loop.run_in_executor(None, lambda: pq.write_table(table, f"{data_dir}/{file_name}"))
    print(f"downloaded: {file_name}")

async def download_all(parquets: list[str], start: int, fails: bool):
    tasks = []
    failed: list[str] = []
    total_count: int = 0
    downloaded_count: int = 0
    failed_count: int = 0
    cancelled_count: int = 0
    try:
        async with aiohttp.ClientSession() as session:
            tasks = [asyncio.create_task(download_parquet(session, parquet)) for parquet in parquets]
            done, _ = await asyncio.wait(tasks, return_when=asyncio.ALL_COMPLETED)

            for parquet, task in zip(parquets,tasks):
                if not task.cancelled() and task.exception():
                    failed.append(parquet)

            total_count = len(done)
            downloaded_count = sum(1 for task in done if not task.exception())
            failed_count = len(failed)

    except asyncio.CancelledError:
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

        total_count = sum(1 for t in tasks if t.done() and not t.cancelled())
        downloaded_count = sum(
                1 for t in tasks 
                if t.done() and not t.cancelled() and not t.exception()
        )
        failed = [
                p for t, p in zip(tasks, parquets) 
                if t.done() and not t.cancelled() and t.exception()
        ]
        failed_count = len(failed)
        if (fails):
            failed += [p for t, p in zip(tasks, parquets) if t.cancelled()]
            cancelled_count = len(failed) - failed_count

    finally:
        print("\ndone...")
        end = start + total_count

        if downloaded_count < len(parquets):
            print(f"{downloaded_count}/{len(parquets)} files downloaded.")
        elif downloaded_count == len(parquets):
            print(f"all files successfully downloaded")
            if (fails and not failed and Path("download_fails").exists()):
                remove("download_fails")

        if (not fails):
            with open("start", 'wb') as start_f:
                start_f.write(struct.pack(">I",end))

        if failed:
            print(f"{failed_count} files sent an error")
            with open("download_fails", 'w') as fail_f:
                fail_f.writelines(fail + "\n" for fail in failed)
            print(f"{cancelled_count} failed files still remain")
    return end

def main():
    if(not Path("start").exists()):
        with open("start", 'wb') as f:
            f.write(struct.pack(">I", 0))

    parser = ArgumentParser()
    parser.add_argument("--start-at", type=int, default=None, help="starting index")
    parser.add_argument("--limit-downloads", type=int, default=None, help="limit number of downloads")
    parser.add_argument("--reset-index", action="store_true", help="Reset the starting index")
    parser.add_argument("--download-fails", action="store_true", help="Retry the failed downloads")

    with open("manifest.json", 'r') as f:
        manifest = json.load(f)
    # with open("eBirdStateMapping.json", 'r') as f:
    #     ebird_state_mapping = json.load(f)
    # with open("eBirdCountryMapping.json", 'r') as f:
    #     ebird_country_mapping = json.load(f)

    args = parser.parse_args()

    parquets: list[str] = []

    if (args.download_fails):
        if (not Path('download_fails').exists()):
            print("no such files... exiting")
            return
        with open("download_fails", 'r') as f:
            parquets = [parquet.strip() for parquet in f.readlines()]
        start_point = 0
    else:
        parquets = [
                parquet for parquet in manifest
                if re.search(r"US[^-].+", parquet)
                # if re.search(r"US-.+", parquet)
                if re.search(r"US[^-]", parquet)
        ]

    if (args.reset_index):
        with open("start", 'wb') as f:
            f.write(struct.pack(">I", 0))
        if Path("download_fails").exists():
            remove("download_fails")
        print("Index reset to 0")
        return
    elif (args.start_at is not None):
        if (args.start_at > len(parquets)):
            print("starting index too large... exiting")
            return
        start_point = args.start_at
    elif not args.download_fails:
        with open("start", 'rb') as f:
            start_point = struct.unpack(">I", f.read())[0]

    limit_downloads = len(parquets)
    if (args.limit_downloads is not None):
        limit_downloads = args.limit_downloads

    if (start_point >= len(parquets)):
        print("No more files to process... use --reset-index to begin at index 0")
        return

    print(f"downloading {min(limit_downloads, len(parquets))} files...")
    print(f"starting index is: {start_point}")
    end = asyncio.run(download_all(parquets[start_point:start_point + limit_downloads], start_point, args.download_fails))
    print(f"ending index is {end}")

if __name__ == "__main__":
    main()

