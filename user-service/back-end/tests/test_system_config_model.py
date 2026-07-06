# tests/test_system_config_model.py
from __future__ import annotations

import pytest
from sqlalchemy import inspect

from app.domain.models import Base
import app.domain.models.associations  # noqa: F401
import app.domain.models.department  # noqa: F401
import app.domain.models.role  # noqa: F401
import app.domain.models.user  # noqa: F401
import app.domain.models.system_config  # noqa: F401

pytestmark = pytest.mark.asyncio


def test_system_config_columns():
    cols = {c.name for c in inspect(Base.metadata.tables["system_config"]).columns}
    assert {"id", "config_key", "config_value", "config_group", "config_type",
            "is_encrypted", "description", "updated_by",
            "created_at", "updated_at"} <= cols
    assert Base.metadata.tables["system_config"].columns["config_key"].unique is True


def test_config_history_columns():
    cols = {c.name for c in inspect(Base.metadata.tables["config_history"]).columns}
    assert {"id", "config_key", "old_value", "new_value", "changed_by", "changed_at"} <= cols
    assert Base.metadata.tables["config_history"].columns["changed_at"].index is True


def test_email_template_columns():
    cols = {c.name for c in inspect(Base.metadata.tables["email_template"]).columns}
    assert {"id", "template_code", "template_name", "subject", "content",
            "variables", "is_active", "created_at", "updated_at"} <= cols
    assert Base.metadata.tables["email_template"].columns["template_code"].unique is True