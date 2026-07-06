from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.application.schemas.system_config import (
    GROUP_MODELS, MailConfig, SecurityPolicy, SystemParams, group_of_key,
)

pytestmark = pytest.mark.asyncio


def test_group_of_key():
    assert group_of_key("mail.host") == "MAIL"
    assert group_of_key("security.password_min_length") == "SECURITY"
    assert group_of_key("performance.cache_user_info_ttl") == "PERFORMANCE"
    assert group_of_key("system.site_name") == "SYSTEM"


def test_group_of_key_unknown():
    with pytest.raises(ValueError):
        group_of_key("unknown.x")


def test_security_policy_validates_range():
    with pytest.raises(ValidationError):
        SecurityPolicy(
            password_min_length=3,  # < 6
            password_require_uppercase=True, password_require_lowercase=True,
            password_require_digits=True, password_require_special=True,
            password_history_size=5, password_expiration_days=90,
            login_max_attempts=5, login_lock_minutes=30, session_timeout_minutes=15,
        )


def test_mail_config_port_range():
    with pytest.raises(ValidationError):
        MailConfig(host="smtp", port=99999, username="u", password="p")


def test_system_params_locale_pattern():
    with pytest.raises(ValidationError):
        SystemParams(site_name="x", default_locale="invalid", support_email="a@b.com")


def test_group_models_keys():
    assert set(GROUP_MODELS.keys()) == {"MAIL", "SECURITY", "PERFORMANCE", "SYSTEM"}