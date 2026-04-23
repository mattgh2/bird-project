from __future__ import annotations

from bird_project.clients.base import ServiceClient


class CatalogClient(ServiceClient):
    def __init__(self, base_url: str = "http://localhost:8002"):
        super().__init__(service="catalog", base_url=base_url)

