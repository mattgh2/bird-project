from __future__ import annotations

from dataclasses import dataclass
from urllib.request import urlopen


@dataclass(frozen=True, slots=True)
class ServiceClient:
    service: str
    base_url: str

    def health_url(self) -> str:
        return f"{self.base_url.rstrip('/')}/health"

    def ping(self) -> bytes:
        with urlopen(self.health_url()) as response:
            return response.read()

