from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio


async def _h(token):
    return {"Authorization": f"Bearer {token}"}


async def test_init_and_get_group_masks_secret(client, admin_token):
    resp = await client.post("/api/v1/config/init", headers=await _h(admin_token))
    assert resp.status_code == 200, resp.text
    grp = await client.get("/api/v1/config?group=MAIL", headers=await _h(admin_token))
    assert grp.status_code == 200
    body = grp.json()
    assert body["group"] == "MAIL"
    assert body["values"]["password"] == "***"


async def test_get_groups(client, admin_token):
    await client.post("/api/v1/config/init", headers=await _h(admin_token))
    resp = await client.get("/api/v1/config/groups", headers=await _h(admin_token))
    assert resp.status_code == 200
    assert set(resp.json()) == {"MAIL", "SECURITY", "PERFORMANCE", "SYSTEM"}


async def test_put_value_validates(client, admin_token):
    await client.post("/api/v1/config/init", headers=await _h(admin_token))
    resp = await client.put("/api/v1/config/security.password_min_length",
                            json={"value": "3"}, headers=await _h(admin_token))
    assert resp.status_code == 400


async def test_put_value_secret(client, admin_token):
    await client.post("/api/v1/config/init", headers=await _h(admin_token))
    resp = await client.put("/api/v1/config/mail.password",
                            json={"value": "new-secret"}, headers=await _h(admin_token))
    assert resp.status_code == 200, resp.text
    # GET 单 key 掩码
    g = await client.get("/api/v1/config/mail.password", headers=await _h(admin_token))
    assert g.status_code == 200 and g.json()["value"] == "***"


async def test_history(client, admin_token):
    await client.post("/api/v1/config/init", headers=await _h(admin_token))
    await client.put("/api/v1/config/system.site_name",
                     json={"value": "NewName"}, headers=await _h(admin_token))
    resp = await client.get("/api/v1/config/history?key=system.site_name",
                            headers=await _h(admin_token))
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


async def test_regular_user_forbidden(client):
    reg = await client.post("/api/v1/auth/register", json={
        "email": "r@t.com", "password": "Rr@12345", "first_name": "R", "last_name": "L"})
    assert reg.status_code == 201
    login = await client.post("/api/v1/auth/login", json={"email": "r@t.com", "password": "Rr@12345"})
    token = login.json()["access_token"]
    resp = await client.put("/api/v1/config/system.site_name",
                            json={"value": "x"}, headers=await _h(token))
    assert resp.status_code == 403