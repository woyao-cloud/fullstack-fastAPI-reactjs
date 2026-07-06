"""系统配置路由."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.deps import get_db
from app.core.config_cache import ConfigCache, get_config_cache
from app.core.security import require_permission
from app.domain.models.user import User
from app.repositories.system_config_repository import (
    ConfigHistoryRepository, SystemConfigRepository,
)
from app.application.services.config_service import ConfigService
from app.core import crypto

router = APIRouter(prefix="/config", tags=["config"])


def _svc(db: AsyncSession, cache: ConfigCache) -> ConfigService:
    return ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db), crypto, cache)


class ConfigValueUpdate(BaseModel):
    value: str | int | bool | dict


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
    values = await svc.get_group(group)
    return {"group": group, "values": _mask(values, group)}


@router.get("/history")
async def history(
    key: str = Query(...),
    db: AsyncSession = Depends(get_db),
    cache: ConfigCache = Depends(get_config_cache),
    user: User = Depends(require_permission("config:read")),
) -> list[dict]:
    repo = ConfigHistoryRepository(db)
    rows = await repo.list_by_key(key)
    from app.application.schemas.system_config import group_of_key, GROUP_MODELS
    group = group_of_key(key)
    field = key.split(".", 1)[1]
    fi = GROUP_MODELS[group].model_fields.get(field)
    is_secret = fi is not None and "SecretStr" in str(fi.annotation)
    out = []
    for r in rows:
        out.append({
            "key": r.config_key,
            "old_value": "***" if is_secret else r.old_value,
            "new_value": "***" if is_secret else r.new_value,
            "changed_by": str(r.changed_by),
            "changed_at": r.changed_at.isoformat() if r.changed_at else None,
        })
    return out


@router.get("/{key}")
async def get_value(
    key: str,
    db: AsyncSession = Depends(get_db),
    cache: ConfigCache = Depends(get_config_cache),
    user: User = Depends(require_permission("config:read")),
) -> dict:
    svc = _svc(db, cache)
    from app.application.schemas.system_config import group_of_key, GROUP_MODELS
    group = group_of_key(key)
    values = await svc.get_group(group)
    field = key.split(".", 1)[1]
    val = values.get(field)
    fi = GROUP_MODELS[group].model_fields.get(field)
    if fi is not None and "SecretStr" in str(fi.annotation):
        val = "***"
    return {"key": key, "group": group, "value": val}


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