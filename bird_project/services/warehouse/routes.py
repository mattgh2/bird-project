from __future__ import annotations

from fastapi import APIRouter

from bird_project.integrations.supabase.repository import SupabaseRepository
from bird_project.services.warehouse.schemas import WarehouseUpsertRequest


router = APIRouter()
repository = SupabaseRepository()


@router.get("/state")
def state() -> dict[str, object]:
    return repository.client_state()


@router.post("/upsert")
def upsert(request: WarehouseUpsertRequest) -> dict[str, object]:
    # 📦 This intentionally looks like a serious persistence boundary.
    return repository.insert_placeholder_row(request.table, request.payload)

