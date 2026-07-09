"""测试数据生成脚本 — 直接操作数据库，幂等执行。

用法:
    python -m scripts.seed

环境变量:
    DATABASE_URL: 数据库连接串 (默认 sqlite+aiosqlite:///./user_service.db)
"""

from __future__ import annotations

import asyncio
import os
import sys
import uuid

# 确保能找到 app 包
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt

from passlib.context import CryptContext
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# 确保模型注册
import app.domain.models.associations  # noqa: F401
import app.domain.models.department  # noqa: F401
import app.domain.models.role  # noqa: F401
import app.domain.models.user  # noqa: F401
from app.domain.models import Base
from app.domain.models.department import Department
from app.domain.models.enums import DataScope, UserStatus
from app.domain.models.role import Permission, Role
from app.domain.models.user import User

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./user_service.db")


def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

# ─── 数据定义 ───────────────────────────────────────────────

PERMISSIONS = [
    # 用户管理
    ("user:read", "查询用户", "ACTION", "users", "read"),
    ("user:create", "创建用户", "ACTION", "users", "create"),
    ("user:update", "编辑用户", "ACTION", "users", "update"),
    ("user:delete", "删除用户", "ACTION", "users", "delete"),
    ("user:assign_role", "分配角色", "ACTION", "users", "assign_role"),
    # 部门管理
    ("dept:read", "查询部门", "ACTION", "departments", "read"),
    ("dept:create", "创建部门", "ACTION", "departments", "create"),
    ("dept:update", "编辑部门", "ACTION", "departments", "update"),
    ("dept:delete", "删除部门", "ACTION", "departments", "delete"),
    # 角色管理
    ("role:read", "查询角色", "ACTION", "roles", "read"),
    ("role:create", "创建角色", "ACTION", "roles", "create"),
    ("role:update", "编辑角色", "ACTION", "roles", "update"),
    ("role:delete", "删除角色", "ACTION", "roles", "delete"),
    # 系统配置
    ("config:read", "读取配置", "ACTION", "config", "read"),
    ("config:update", "更新配置", "ACTION", "config", "update"),
    # 审计日志
    ("audit:read", "查看审计日志", "ACTION", "audit", "read"),
]

ROLES = {
    "SUPER_ADMIN": {
        "name": "超级管理员",
        "description": "系统超级管理员，拥有所有权限",
        "data_scope": DataScope.ALL,
        "permissions": [p[0] for p in PERMISSIONS],
    },
    "ADMIN": {
        "name": "管理员",
        "description": "系统管理员，拥有基础管理权限",
        "data_scope": DataScope.DEPT,
        "permissions": ["user:read", "user:create", "role:read",
                        "dept:read", "dept:create", "config:read"],
    },
    "USER": {
        "name": "普通用户",
        "description": "普通系统用户",
        "data_scope": DataScope.SELF,
        "permissions": ["user:read"],
    },
}

DEPARTMENTS = [
    {"code": "HQ", "name": "总公司", "parent_code": None},
    {"code": "TECH", "name": "技术部", "parent_code": "HQ"},
    {"code": "FE", "name": "前端组", "parent_code": "TECH"},
    {"code": "BE", "name": "后端组", "parent_code": "TECH"},
    {"code": "HR", "name": "人事部", "parent_code": "HQ"},
    {"code": "FIN", "name": "财务部", "parent_code": "HQ"},
]

USERS = [
    {"email": "admin@test.com", "password": "AdminPass123!",
     "first_name": "系统", "last_name": "管理员",
     "role": "SUPER_ADMIN", "dept_code": "TECH"},
    {"email": "zhangwei@test.com", "password": "TestPass123!",
     "first_name": "张", "last_name": "伟",
     "role": "USER", "dept_code": "FE"},
    {"email": "lina@test.com", "password": "TestPass123!",
     "first_name": "李", "last_name": "娜",
     "role": "USER", "dept_code": "BE"},
    {"email": "wangfang@test.com", "password": "TestPass123!",
     "first_name": "王", "last_name": "芳",
     "role": "USER", "dept_code": "HR"},
    {"email": "zhaomin@test.com", "password": "TestPass123!",
     "first_name": "赵", "last_name": "敏",
     "role": "USER", "dept_code": "FIN"},
]


# ─── Seed 逻辑 ──────────────────────────────────────────────

async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as db:
        print("=" * 50)
        print("开始 seed 测试数据...")
        print("=" * 50)

        # 1. 权限
        perm_map = {}
        for code, name, ptype, resource, action in PERMISSIONS:
            result = await db.execute(select(Permission).where(Permission.code == code))
            existing = result.unique().scalar_one_or_none()
            if existing:
                perm_map[code] = existing
                continue
            perm = Permission(code=code, name=name, type=ptype, resource=resource, action=action)
            db.add(perm)
            perm_map[code] = perm
            print(f"  [+] 权限: {code}")
        await db.commit()
        # Refresh perm_map after commit
        for code in perm_map:
            await db.refresh(perm_map[code])
        print(f"  权限: {len(perm_map)} 个就绪")

        # 2. 角色
        role_map = {}
        for code, cfg in ROLES.items():
            result = await db.execute(select(Role).where(Role.code == code))
            existing = result.unique().scalar_one_or_none()
            if existing:
                role_map[code] = existing
                continue
            role = Role(name=cfg["name"], code=code, description=cfg["description"],
                        data_scope=cfg["data_scope"], status="ACTIVE")
            # 分配权限
            perms = [perm_map[c] for c in cfg["permissions"] if c in perm_map]
            role.permissions = perms
            db.add(role)
            role_map[code] = role
            print(f"  [+] 角色: {code} ({len(perms)} 权限)")
        await db.commit()
        for code in role_map:
            await db.refresh(role_map[code])
        print(f"  角色: {len(role_map)} 个就绪")

        # 3. 部门（先建树结构，后设 manager）
        dept_map = {}
        # 先创建所有部门（不设 manager）
        for d in DEPARTMENTS:
            result = await db.execute(select(Department).where(Department.code == d["code"]))
            existing = result.unique().scalar_one_or_none()
            if existing:
                dept_map[d["code"]] = existing
                continue
            parent = dept_map.get(d["parent_code"]) if d["parent_code"] else None
            level = (parent.level + 1) if parent else 1
            node_seq_result = await db.execute(select(text("COALESCE(MAX(node_seq), 0) + 1")).select_from(Department))
            node_seq = node_seq_result.scalar()
            path = f"{parent.path}/{node_seq}" if parent else f"/{node_seq}"
            dept = Department(
                name=d["name"], code=d["code"],
                parent_id=parent.id if parent else None,
                level=level, path=path, node_seq=node_seq, sort_order=0,
                status="ACTIVE",
            )
            db.add(dept)
            await db.flush()
            dept_map[d["code"]] = dept
            print(f"  [+] 部门: {d['name']} (level={level})")
        await db.commit()
        for code in dept_map:
            await db.refresh(dept_map[code])
        print(f"  部门: {len(dept_map)} 个就绪")

        # 4. 用户
        user_map = {}
        for u in USERS:
            result = await db.execute(select(User).where(User.email == u["email"]))
            existing = result.unique().scalar_one_or_none()
            if existing:
                user_map[u["email"]] = existing
                continue
            dept = dept_map.get(u["dept_code"])
            user = User(
                email=u["email"],
                password_hash=_hash_password(u["password"]),
                first_name=u["first_name"],
                last_name=u["last_name"],
                department_id=dept.id if dept else None,
                status=UserStatus.ACTIVE,
                email_verified=True,
                is_active=True,
            )
            role = role_map.get(u["role"])
            if role:
                user.roles = [role]
            db.add(user)
            await db.flush()
            user_map[u["email"]] = user
            print(f"  [+] 用户: {u['email']} ({u['first_name']}{u['last_name']})")
        await db.commit()
        for email in user_map:
            await db.refresh(user_map[email])

        # 5. 设置部门负责人
        admin_user = user_map.get("admin@test.com")
        if admin_user:
            tech_dept = dept_map.get("TECH")
            if tech_dept and not tech_dept.manager_id:
                tech_dept.manager_id = admin_user.id
                await db.commit()
                print(f"  [~] 部门负责人: 技术部 → {admin_user.email}")

        print("=" * 50)
        print("Seed 完成!")
        print(f"  权限: {len(perm_map)}")
        print(f"  角色: {len(role_map)}")
        print(f"  部门: {len(dept_map)}")
        print(f"  用户: {len(user_map)}")
        print("=" * 50)
        print()
        print("测试账号:")
        for u in USERS:
            print(f"  {u['email']} / {u['password']} ({u['role']})")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
