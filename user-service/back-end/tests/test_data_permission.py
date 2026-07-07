# tests/test_data_permission.py
from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.application.schemas.user import UserCreate
from app.application.services.user_service import UserService
from app.domain.models.user import User

pytestmark = pytest.mark.asyncio


async def test_create_sets_created_by(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        # 先建一个 actor 用户(系统建,created_by=None)
        actor = await UserService(db).create(
            UserCreate(email="actor@test.com", password="Actor@1234",
                       first_name="Actor", last_name="L"), actor=None)
        await db.commit()
        # 以 actor 身份建另一用户
        created = await UserService(db).create(
            UserCreate(email="child@test.com", password="Child@1234",
                       first_name="Child", last_name="L"), actor=actor)
        await db.commit()
        assert created.created_by == actor.id


async def test_create_without_actor_has_no_created_by(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        u = await UserService(db).create(
            UserCreate(email="noparent@test.com", password="NoP@1234",
                       first_name="No", last_name="P"), actor=None)
        await db.commit()
        assert u.created_by is None