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


async def test_admin_all_sees_all_users(client, admin_token):
    # admin(ALL)能看到所有用户
    h = await _auth_header(admin_token)
    create = await client.post("/api/v1/users", json={
        "email": "selfuser@test.com", "password": "Self@1234",
        "first_name": "Self", "last_name": "L"}, headers=h)
    assert create.status_code == 201
    lst = await client.get("/api/v1/users", headers=h)
    assert lst.status_code == 200
    emails = {u["email"] for u in lst.json()["items"]}
    assert "selfuser@test.com" in emails


async def test_get_other_as_regular_404(client):
    # 普通用户(SELF,注册即 USER 角色 data_scope=SELF)查不属于自己的用户 → 404
    reg = await client.post("/api/v1/auth/register", json={
        "email": "reg@t.com", "password": "Reg@1234",
        "first_name": "R", "last_name": "L"})
    assert reg.status_code == 201
    other = await client.post("/api/v1/auth/register", json={
        "email": "other@t.com", "password": "Other@1234",
        "first_name": "O", "last_name": "L"})
    assert other.status_code == 201
    login = await client.post("/api/v1/auth/login",
                              json={"email": "reg@t.com", "password": "Reg@1234"})
    token = login.json()["access_token"]
    resp = await client.get(f"/api/v1/users/{other.json()['id']}",
                           headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404


async def test_self_can_see_own_via_api(client):
    reg = await client.post("/api/v1/auth/register", json={
        "email": "own@t.com", "password": "Own@1234",
        "first_name": "O", "last_name": "L"})
    assert reg.status_code == 201
    uid = reg.json()["id"]
    login = await client.post("/api/v1/auth/login",
                              json={"email": "own@t.com", "password": "Own@1234"})
    token = login.json()["access_token"]
    resp = await client.get(f"/api/v1/users/{uid}",
                           headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200  # 本人直查