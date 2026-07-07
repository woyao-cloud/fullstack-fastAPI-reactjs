## Task 4: API 注入 current_user + get_user 本人直查

**Files:**
- Modify: `app/interfaces/api/users.py`(`list_users`、`get_user` 注入 current_user)
- Test: `tests/test_users_api.py`(追加 API 过滤用例)

**Interfaces:**
- Produces:`list_users`/`get_user` 路由注入 `current_user: User = Depends(get_current_user)` 并传入 service;`get_user` 本人(`current_user.id == user_id`)直接返,否则走 service.get(user_id, current_user) 过滤。

- [ ] **Step 1: 写失败测试(追加到 tests/test_users_api.py)**

```python
# tests/test_users_api.py —— 末尾追加


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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_users_api.py -v`
Expected: 新用例可能 PASS(现有 get_user 本人直查已支持)或 FAIL(list_users 尚未过滤普通用户)。

- [ ] **Step 3: 修改 users 路由注入 current_user**

在 `app/interfaces/api/users.py` 修改 `list_users` 和 `get_user`。用 `get_current_user` 取一次用户,内联检查 `user:read` 权限码(避免 `require_permission` + `get_current_user` 重复取用户),再走 data_scope 过滤。顶部 import 确认含 `get_current_user`(若仅 `require_permission` 则补 `from app.core.security import get_current_user`)。

```python
@router.get("", response_model=UserListOut)
async def list_users(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserListOut:
    codes = await current_user.permission_codes()
    if "user:read" not in codes:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "缺少权限: user:read")
    service = UserService(db)
    items, total = await service.list(page, size, current_user=current_user)
    return UserListOut(
        items=[UserOut.model_validate(u) for u in items], total=total, page=page, size=size
    )


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserOut:
    if current_user.id == user_id:
        return UserOut.model_validate(current_user)
    codes = await current_user.permission_codes()
    if "user:read" not in codes:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "缺少权限: user:read")
    service = UserService(db)
    return UserOut.model_validate(await service.get(user_id, current_user=current_user))
```
(`HTTPException`/`status` 需在文件顶部 import:确认 `from fastapi import HTTPException, status` 存在;若缺则补。)`create_user` 已在 Task 1 改为 `actor=current_user`;其他路由不变。

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_users_api.py -v`
Expected: PASS(含新用例);全量无回归。

- [ ] **Step 5: 提交**

```bash
git add app/interfaces/api/users.py tests/test_users_api.py
git commit -m "feat(dataperm): API 注入 current_user + 本人直查 + 权限码内联检查"
```

---

