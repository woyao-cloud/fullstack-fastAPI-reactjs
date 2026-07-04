"""用户 CRUD + 权限测试."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio

NEW_USER = {
    "email": "bob@test.com",
    "password": "Bob@12345",
    "first_name": "Bob",
    "last_name": "Li",
}


async def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_admin_create_user(client, admin_token):
    resp = await client.post(
        "/api/v1/users", json=NEW_USER, headers=await _auth_header(admin_token)
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["email"] == "bob@test.com"


async def test_admin_list_users(client, admin_token):
    await client.post("/api/v1/users", json=NEW_USER, headers=await _auth_header(admin_token))
    resp = await client.get("/api/v1/users", headers=await _auth_header(admin_token))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["total"] >= 2  # admin + bob
    assert len(data["items"]) >= 2


async def test_regular_user_cannot_create(client):
    # 注册普通用户（无 user:create 权限）
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "charlie@test.com",
            "password": "Charlie@123",
            "first_name": "Charlie",
            "last_name": "Zhang",
        },
    )
    assert reg.status_code == 201
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "charlie@test.com", "password": "Charlie@123"},
    )
    token = login.json()["access_token"]
    resp = await client.post("/api/v1/users", json=NEW_USER, headers=await _auth_header(token))
    assert resp.status_code == 403


async def test_admin_update_and_delete_user(client, admin_token):
    create = await client.post(
        "/api/v1/users", json=NEW_USER, headers=await _auth_header(admin_token)
    )
    uid = create.json()["id"]
    upd = await client.put(
        f"/api/v1/users/{uid}",
        json={"first_name": "Bobby"},
        headers=await _auth_header(admin_token),
    )
    assert upd.status_code == 200
    assert upd.json()["first_name"] == "Bobby"

    dele = await client.delete(f"/api/v1/users/{uid}", headers=await _auth_header(admin_token))
    assert dele.status_code == 204


async def test_get_user_self(client):
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "self@test.com",
            "password": "Self@1234",
            "first_name": "Self",
            "last_name": "Test",
        },
    )
    uid = reg.json()["id"]
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "self@test.com", "password": "Self@1234"},
    )
    token = login.json()["access_token"]
    resp = await client.get(f"/api/v1/users/{uid}", headers=await _auth_header(token))
    assert resp.status_code == 200
    assert resp.json()["id"] == uid


async def test_admin_assign_role_not_found(client, admin_token):
    create = await client.post(
        "/api/v1/users",
        json={
            "email": "dave@test.com",
            "password": "Dave@12345",
            "first_name": "Dave",
            "last_name": "Sun",
        },
        headers=await _auth_header(admin_token),
    )
    assert create.status_code == 201, create.text
    uid = create.json()["id"]

    # 分配不存在的角色 -> 404
    resp = await client.post(
        f"/api/v1/users/{uid}/roles/00000000-0000-0000-0000-000000000000",
        headers=await _auth_header(admin_token),
    )
    assert resp.status_code == 404


async def test_admin_get_other_user_as_admin(client, admin_token):
    create = await client.post(
        "/api/v1/users",
        json={
            "email": "erin@test.com",
            "password": "Erin@12345",
            "first_name": "Erin",
            "last_name": "Zhou",
        },
        headers=await _auth_header(admin_token),
    )
    uid = create.json()["id"]
    resp = await client.get(f"/api/v1/users/{uid}", headers=await _auth_header(admin_token))
    assert resp.status_code == 200
    assert resp.json()["email"] == "erin@test.com"