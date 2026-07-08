"""压力测试数据准备: 创建测试用户 + 部门 + 角色.

用法:
    python tests/performance/seed_data.py

环境变量:
    API_BASE: API 基础 URL (默认 http://localhost:8000/api/v1)
    ADMIN_EMAIL: 管理员邮箱 (默认 admin@test.com)
    ADMIN_PASSWORD: 管理员密码 (默认 AdminPass123!)
    USER_COUNT: 测试用户数 (默认 100)
"""

import os
import sys

import httpx

API_BASE = os.getenv("API_BASE", "http://localhost:8000/api/v1")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@test.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "AdminPass123!")
USER_COUNT = int(os.getenv("USER_COUNT", "100"))


def main():
    client = httpx.Client(base_url=API_BASE, timeout=30)

    # 1. 管理员登录
    print("管理员登录...")
    r = client.post("/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
    })
    if r.status_code != 200:
        print(f"管理员登录失败: {r.text}")
        sys.exit(1)
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. 创建测试部门
    print("创建测试部门...")
    r = client.post("/departments", json={
        "name": "压力测试部",
        "code": "STRESS_DEPT",
    }, headers=headers)
    if r.status_code == 201:
        dept_id = r.json()["id"]
        print(f"  部门创建成功: {dept_id}")
    elif r.status_code == 409:
        print("  部门已存在")
        r = client.get("/departments?page=1&size=10", headers=headers)
        dept_id = r.json()["items"][0]["id"]
    else:
        print(f"  部门创建失败: {r.text}")
        dept_id = None

    # 3. 创建测试用户
    print(f"创建 {USER_COUNT} 个测试用户...")
    created = 0
    for i in range(USER_COUNT):
        email = f"stress{i}@test.com"
        r = client.post("/auth/register", json={
            "email": email,
            "password": "StressPass123!",
            "first_name": "Stress",
            "last_name": f"User{i}",
        })
        if r.status_code == 201:
            created += 1
        elif r.status_code == 409:
            pass  # 已存在
        else:
            print(f"  用户 {email} 创建失败: {r.text}")

    print(f"完成: {created} 个新用户创建")
    print(f"运行 k6: k6 run tests/performance/k6-login.js")


if __name__ == "__main__":
    main()
