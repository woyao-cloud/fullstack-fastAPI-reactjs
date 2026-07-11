"""领域枚举."""

from __future__ import annotations

import enum


class UserStatus(enum.StrEnum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    LOCKED = "LOCKED"


class PermissionType(enum.StrEnum):
    MENU = "MENU"
    ACTION = "ACTION"
    FIELD = "FIELD"
    DATA = "DATA"


class DataScope(enum.StrEnum):
    ALL = "ALL"
    DEPT = "DEPT"
    SELF = "SELF"
    CUSTOM = "CUSTOM"