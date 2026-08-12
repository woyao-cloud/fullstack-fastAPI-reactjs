"""幂等地为 user-service(sqlite) 注入三模块权限并赋给 SUPER_ADMIN。

用法: python scripts/seed_module_permissions.py
     或 docker compose exec user-service python scripts/seed_module_permissions.py

容器首次启动时 user_service.db 为空表(仅 Base.metadata.create_all 建表、无角色数据),
本脚本自举 SUPER_ADMIN 角色(不存在则按 scripts/seed.py 同规格创建),再注入
product/inventory/order 的 manage 权限并建立 role_permission 映射。全程幂等可重跑。
"""
import os
import sqlite3

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "user_service.db")
PERMISSIONS = ["product:manage", "inventory:manage", "order:manage"]


def main() -> None:
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    # 自举 SUPER_ADMIN 角色(不存在才创建);created_at/updated_at 走表 DEFAULT CURRENT_TIMESTAMP
    cur.execute(
        "INSERT OR IGNORE INTO role (id, name, code, description, data_scope, status) "
        "VALUES (lower(hex(randomblob(16))), '超级管理员', 'SUPER_ADMIN', "
        "'系统超级管理员，拥有所有权限', 'ALL', 'ACTIVE')"
    )
    admin_role = cur.execute(
        "SELECT id FROM role WHERE code='SUPER_ADMIN'"
    ).fetchone()
    if admin_role is None:
        print("SUPER_ADMIN role not found; skip")
        return
    role_id = admin_role[0]

    for code in PERMISSIONS:
        resource, action = code.split(":", 1)
        # 列名以 app/domain/models/role.py Permission 为准: name/code/type/resource/action
        cur.execute(
            "INSERT OR IGNORE INTO permission (id, name, code, type, resource, action) "
            "VALUES (lower(hex(randomblob(16))), ?, ?, 'ACTION', ?, ?)",
            (code, code, resource, action),
        )
        pid = cur.execute("SELECT id FROM permission WHERE code=?", (code,)).fetchone()[0]
        cur.execute(
            "INSERT OR IGNORE INTO role_permission (role_id, permission_id) VALUES (?, ?)",
            (role_id, pid),
        )
    conn.commit()
    print("seeded:", PERMISSIONS)
    conn.close()


if __name__ == "__main__":
    main()
