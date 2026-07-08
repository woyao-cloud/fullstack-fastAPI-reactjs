"""密码策略校验服务."""

from __future__ import annotations

import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.schemas.system_config import SecurityPolicy
from app.application.services.config_service import ConfigService
from app.core.config_cache import ConfigCache, get_config_cache
from app.repositories.system_config_repository import (
    ConfigHistoryRepository,
    SystemConfigRepository,
)


class PasswordPolicyError(ValueError):
    pass


class PasswordPolicyService:
    def __init__(self, db: AsyncSession, cache: ConfigCache):
        self.db = db
        self.cache = cache

    async def get_policy(self) -> SecurityPolicy:
        """从系统配置读取安全策略."""
        svc = ConfigService(
            self.db,
            SystemConfigRepository(self.db),
            ConfigHistoryRepository(self.db),
            None,  # crypto not needed for reading
            self.cache,
        )
        values = await svc.get_group("SECURITY")
        return SecurityPolicy(**values)

    async def validate(self, password: str) -> None:
        """校验密码是否符合当前安全策略，不符合则抛出 PasswordPolicyError."""
        policy = await self.get_policy()
        errors: list[str] = []

        if len(password) < policy.password_min_length:
            errors.append(f"密码长度不能少于 {policy.password_min_length} 位")

        if policy.password_require_uppercase and not re.search(r"[A-Z]", password):
            errors.append("密码必须包含大写字母")

        if policy.password_require_lowercase and not re.search(r"[a-z]", password):
            errors.append("密码必须包含小写字母")

        if policy.password_require_digits and not re.search(r"\d", password):
            errors.append("密码必须包含数字")

        if policy.password_require_special and not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\;'/`~]", password):
            errors.append("密码必须包含特殊字符")

        if errors:
            raise PasswordPolicyError("；".join(errors))