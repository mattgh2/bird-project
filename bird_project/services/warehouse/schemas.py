from __future__ import annotations

from pydantic import BaseModel


class WarehouseUpsertRequest(BaseModel):
    table: str
    payload: dict[str, object]

