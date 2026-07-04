"""领域枚举."""

from __future__ import annotations

import enum


class UserStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    LOCKED = "LOCKED"


class PermissionType(str, enum.Enum):
    MENU = "MENU"
    ACTION = "ACTION"
    FIELD = "FIELD"
    DATA = "DATA"


class DataScope(str, enum.Enum):
    ALL = "ALL"
    DEPT = "DEPT"
    SELF = "SELF"
    CUSTOM = "CUSTOM"