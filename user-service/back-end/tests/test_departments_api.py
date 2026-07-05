"""部门 API 路由测试."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio

DEPT = {"name": "总部", "code": "HQ"}


async def _h(token):
    return {"Authorization": f"Bearer {token}"}


async def test_create_and_get_tree(client, admin_token):
    resp = await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))
    assert resp.status_code == 201, resp.text
    assert resp.json()["level"] == 1
    tree = await client.get("/api/v1/departments/tree", headers=await _h(admin_token))
    assert tree.status_code == 200
    assert tree.json()[0]["code"] == "HQ"


async def test_create_code_conflict(client, admin_token):
    await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))
    resp = await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))
    assert resp.status_code == 409


async def test_move_endpoint(client, admin_token):
    hq = (await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))).json()
    sl = (await client.post("/api/v1/departments", json={"name": "销售", "code": "SL"},
                            headers=await _h(admin_token))).json()
    rd = (await client.post("/api/v1/departments",
                            json={"name": "研发", "code": "RD", "parent_id": hq["id"]},
                            headers=await _h(admin_token))).json()
    resp = await client.post(f"/api/v1/departments/{rd['id']}/move",
                             json={"parent_id": sl["id"]}, headers=await _h(admin_token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["parent_id"] == sl["id"]


async def test_delete_with_children_409(client, admin_token):
    hq = (await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))).json()
    await client.post("/api/v1/departments",
                      json={"name": "研发", "code": "RD", "parent_id": hq["id"]},
                      headers=await _h(admin_token))
    resp = await client.delete(f"/api/v1/departments/{hq['id']}", headers=await _h(admin_token))
    assert resp.status_code == 409


async def test_regular_user_forbidden(client):
    reg = await client.post("/api/v1/auth/register", json={
        "email": "r@t.com", "password": "Rr@12345", "first_name": "R", "last_name": "L"})
    assert reg.status_code == 201
    login = await client.post(
        "/api/v1/auth/login", json={"email": "r@t.com", "password": "Rr@12345"}
    )
    token = login.json()["access_token"]
    resp = await client.post("/api/v1/departments", json=DEPT, headers=await _h(token))
    assert resp.status_code == 403


async def test_list_users_endpoint(client, admin_token):
    hq = (await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))).json()
    resp = await client.get(f"/api/v1/departments/{hq['id']}/users", headers=await _h(admin_token))
    assert resp.status_code == 200
    assert resp.json() == []


async def test_get_subtree_endpoint(client, admin_token):
    hq = (await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))).json()
    await client.post("/api/v1/departments",
                      json={"name": "研发", "code": "RD", "parent_id": hq["id"]},
                      headers=await _h(admin_token))
    resp = await client.get(f"/api/v1/departments/{hq['id']}/subtree",
                            headers=await _h(admin_token))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body) == 1 and body[0]["code"] == "HQ"
    assert [c["code"] for c in body[0]["children"]] == ["RD"]


async def test_list_departments_endpoint(client, admin_token):
    await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))
    await client.post("/api/v1/departments", json={"name": "销售", "code": "SL"},
                      headers=await _h(admin_token))
    resp = await client.get("/api/v1/departments?page=1&size=10",
                            headers=await _h(admin_token))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 2 and body["page"] == 1 and body["size"] == 10
    assert {item["code"] for item in body["items"]} == {"HQ", "SL"}


async def test_get_department_endpoint(client, admin_token):
    hq = (await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))).json()
    resp = await client.get(f"/api/v1/departments/{hq['id']}",
                            headers=await _h(admin_token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["code"] == "HQ"


async def test_get_department_not_found(client, admin_token):
    import uuid as _uuid
    resp = await client.get(f"/api/v1/departments/{_uuid.uuid4()}",
                            headers=await _h(admin_token))
    assert resp.status_code == 404


async def test_update_department_endpoint(client, admin_token):
    hq = (await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))).json()
    resp = await client.put(f"/api/v1/departments/{hq['id']}",
                            json={"name": "总部改"}, headers=await _h(admin_token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["name"] == "总部改"
    assert resp.json()["code"] == "HQ"