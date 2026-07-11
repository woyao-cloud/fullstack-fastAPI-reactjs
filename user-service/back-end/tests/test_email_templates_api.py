from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio


async def _h(token):
    return {"Authorization": f"Bearer {token}"}


TPL = {"template_code": "USER_ACTIVATION", "template_name": "激活",
       "subject": "欢迎", "content": "Hi {{name}}",
       "variables": [{"name": "name", "description": "用户名", "required": True}]}


async def test_template_crud(client, admin_token):
    h = await _h(admin_token)
    create = await client.post("/api/v1/email-templates", json=TPL, headers=h)
    assert create.status_code == 201, create.text
    tid = create.json()["id"]
    got = await client.get(f"/api/v1/email-templates/{tid}", headers=h)
    assert got.status_code == 200 and got.json()["template_code"] == "USER_ACTIVATION"
    lst = await client.get("/api/v1/email-templates", headers=h)
    assert lst.status_code == 200 and lst.json()["total"] == 1
    upd = await client.put(f"/api/v1/email-templates/{tid}",
                           json={"template_name": "激活2"}, headers=h)
    assert upd.status_code == 200 and upd.json()["template_name"] == "激活2"
    dele = await client.delete(f"/api/v1/email-templates/{tid}", headers=h)
    assert dele.status_code == 204


async def test_template_code_conflict(client, admin_token):
    h = await _h(admin_token)
    await client.post("/api/v1/email-templates", json=TPL, headers=h)
    resp = await client.post("/api/v1/email-templates", json=TPL, headers=h)
    assert resp.status_code == 409