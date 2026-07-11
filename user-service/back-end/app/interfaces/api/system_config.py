"""系统配置路由."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.deps import get_db
from app.application.schemas.system_config import ConfigValueUpdate, group_of_key
from app.application.services.config_service import ConfigService
from app.core import crypto
from app.core.config_cache import ConfigCache, get_config_cache
from app.core.security import require_permission
from app.domain.models.user import User
from app.repositories.system_config_repository import (
    ConfigHistoryRepository,
    SystemConfigRepository,
)

router = APIRouter(prefix="/config", tags=["config"])


def _svc(db: AsyncSession, cache: ConfigCache) -> ConfigService:
    return ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db), crypto, cache)


def _mask(values: dict, group: str) -> dict:
    from app.application.schemas.system_config import GROUP_MODELS
    model = GROUP_MODELS[group]
    masked = {}
    for k, v in values.items():
        fi = model.model_fields.get(k)
        if fi is not None and "SecretStr" in str(fi.annotation):
            masked[k] = "***"
        else:
            masked[k] = v
    return masked


def _format_history(rows, key: str, group: str) -> list[dict]:
    from app.application.schemas.system_config import GROUP_MODELS
    field = key.split(".", 1)[1]
    fi = GROUP_MODELS[group].model_fields.get(field)
    is_secret = fi is not None and "SecretStr" in str(fi.annotation)
    return [
        {
            "key": r.config_key,
            "old_value": "***" if is_secret else r.old_value,
            "new_value": "***" if is_secret else r.new_value,
            "changed_by": str(r.changed_by),
            "changed_at": r.changed_at.isoformat() if r.changed_at else None,
        }
        for r in rows
    ]


def _get_value_result(values: dict, key: str, group: str) -> dict:
    from app.application.schemas.system_config import GROUP_MODELS
    field = key.split(".", 1)[1]
    val = values.get(field)
    fi = GROUP_MODELS[group].model_fields.get(field)
    if fi is not None and "SecretStr" in str(fi.annotation):
        val = "***"
    return {"key": key, "group": group, "value": val}


@router.get("/groups")
async def list_groups(
    db: AsyncSession = Depends(get_db),
    cache: ConfigCache = Depends(get_config_cache),
    user: User = Depends(require_permission("config:read")),
) -> list[str]:
    return _svc(db, cache).list_groups()


@router.get("")
async def get_group(
    group: str = Query(...),
    db: AsyncSession = Depends(get_db),
    cache: ConfigCache = Depends(get_config_cache),
    user: User = Depends(require_permission("config:read")),
) -> dict:
    svc = _svc(db, cache)
    return {"group": group, "values": _mask(await svc.get_group(group), group)}


@router.get("/history")
async def history(
    key: str = Query(...),
    db: AsyncSession = Depends(get_db),
    cache: ConfigCache = Depends(get_config_cache),
    user: User = Depends(require_permission("config:read")),
) -> list[dict]:
    try:
        group = group_of_key(key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    repo = ConfigHistoryRepository(db)
    return _format_history(await repo.list_by_key(key), key, group)


@router.get("/{key}")
async def get_value(
    key: str,
    db: AsyncSession = Depends(get_db),
    cache: ConfigCache = Depends(get_config_cache),
    user: User = Depends(require_permission("config:read")),
) -> dict:
    try:
        group = group_of_key(key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    svc = _svc(db, cache)
    values = await svc.get_group(group)
    field = key.split(".", 1)[1]
    if field not in values:
        raise HTTPException(status_code=404, detail=f"配置不存在: {key}")
    return _get_value_result(values, key, group)


@router.put("/{key}")
async def put_value(
    key: str,
    req: ConfigValueUpdate,
    db: AsyncSession = Depends(get_db),
    cache: ConfigCache = Depends(get_config_cache),
    user: User = Depends(require_permission("config:update")),
) -> dict:
    svc = _svc(db, cache)
    await svc.set_value(key, req.value, user.id)
    return {"key": key, "ok": True}


@router.post("/init")
async def init_configs(
    db: AsyncSession = Depends(get_db),
    cache: ConfigCache = Depends(get_config_cache),
    user: User = Depends(require_permission("config:update")),
) -> dict:
    svc = _svc(db, cache)
    await svc.init_default_configs(user.id)
    return {"ok": True}