# tests/test_department_schema.py
from __future__ import annotations

import uuid

import pytest

from app.application.schemas.department import (
    DepartmentCreate,
    DepartmentMove,
    DepartmentTreeNode,
    DepartmentUpdate,
)

pytestmark = pytest.mark.asyncio


def test_department_create_minimal():
    d = DepartmentCreate(name="总部", code="HQ")
    assert d.parent_id is None and d.sort_order == 0


def test_department_update_excludes_parent_id():
    fields = set(DepartmentUpdate.model_fields.keys())
    assert "parent_id" not in fields
    assert "status" in fields


def test_department_move_optional_parent():
    assert DepartmentMove(parent_id=None).parent_id is None
    uid = uuid.uuid4()
    assert DepartmentMove(parent_id=uid).parent_id == uid


def test_tree_node_recursive():
    node = DepartmentTreeNode(
        id=uuid.uuid4(), node_seq=1, name="A", code="A", parent_id=None,
        level=1, path="/1", sort_order=0, manager_id=None, status="ACTIVE",
        created_at="2026-07-05T00:00:00Z", updated_at="2026-07-05T00:00:00Z",
        children=[],
    )
    node.children.append(node.model_copy(update={"node_seq": 2, "level": 2}))
    assert node.children[0].level == 2