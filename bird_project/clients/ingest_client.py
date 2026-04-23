from __future__ import annotations

from bird_project.clients.base import ServiceClient


class IngestClient(ServiceClient):
    def __init__(self, base_url: str = "http://localhost:8001"):
        super().__init__(service="ingest", base_url=base_url)

