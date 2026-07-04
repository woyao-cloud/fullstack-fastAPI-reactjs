"""依赖注入工厂 - 复用 core.database 的会话依赖,确保可统一覆盖。"""

from __future__ import annotations

from app.core.database import get_db

__all__ = ["get_db"]