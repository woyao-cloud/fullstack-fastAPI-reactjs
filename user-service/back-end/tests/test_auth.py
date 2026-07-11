"""认证测试: 注册/登录/刷新/权限."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio

REGISTER_PAYLOAD = {
    "email": "alice@test.com",
    "password": "Alice@1234",
    "first_name": "Alice",
    "last_name": "Wang",
}


async def test_register_success(client):
    resp = await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["email"] == "alice@test.com"
    assert data["status"] == "ACTIVE"


async def test_register_duplicate(client):
    resp = await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    assert resp.status_code == 201
    resp2 = await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    assert resp2.status_code == 409


async def test_register_weak_password(client):
    resp = await client.post(
        "/api/v1/auth/register",
        json={**REGISTER_PAYLOAD, "email": "weak@test.com", "password": "123"},
    )
    assert resp.status_code == 422


async def test_login_success(client):
    await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "alice@test.com", "password": "Alice@1234"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert data["refresh_token"]


async def test_login_wrong_password(client):
    await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "alice@test.com", "password": "Wrong@1234"},
    )
    assert resp.status_code == 401


async def test_refresh_token(client):
    await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "alice@test.com", "password": "Alice@1234"},
    )
    refresh_token = login.json()["refresh_token"]
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200, resp.text
    assert resp.json()["access_token"]


async def test_refresh_with_access_token_rejected(client):
    await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "alice@test.com", "password": "Alice@1234"},
    )
    access_token = login.json()["access_token"]
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": access_token})
    assert resp.status_code == 401


async def test_refresh_with_invalid_token(client):
    resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": "not-a-jwt"}
    )
    assert resp.status_code == 401


async def test_protected_without_token(client):
    resp = await client.get("/api/v1/users")
    assert resp.status_code == 401