# tests/test_department_model.py
from __future__ import annotations

import pytest
from sqlalchemy import inspect

from app.domain.models import Base
import app.domain.models.associations  # noqa: F401
import app.domain.models.role  # noqa: F401
import app.domain.models.user  # noqa: F401
import app.domain.models.department  # noqa: F401

pytestmark = pytest.mark.asyncio


def test_department_columns():
    cols = {c.name for c in inspect(Base.metadata.tables["department"]).columns}
    assert {"id", "node_seq", "name", "code", "parent_id", "level", "path",
            "sort_order", "manager_id", "status", "deleted_at",
            "created_at", "updated_at"} <= cols


def test_department_node_seq_unique():
    node_seq = Base.metadata.tables["department"].columns["node_seq"]
    assert node_seq.unique is True


def test_department_level_check():
    table = Base.metadata.tables["department"]
    has_check = any(
        "LEVEL BETWEEN 1 AND 5" in str(c.sqltext).upper()
        for c in table.constraints
        if hasattr(c, "sqltext")
    )
    assert has_check