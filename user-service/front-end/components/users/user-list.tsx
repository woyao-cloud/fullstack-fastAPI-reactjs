"use client";
import { useState, useEffect } from "react";
import { userApi } from "@/lib/api/users";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { UserFormDialog } from "./user-form-dialog";
import { UserDeleteDialog } from "./user-delete-dialog";
import type { UserOut } from "@/types/user";

export function UserList() {
  const [users, setUsers] = useState<UserOut[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<UserOut | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserOut | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const pageSize = 4;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await userApi.list(page, pageSize);
        if (!cancelled) { setUsers(res.items); setTotal(res.total); }
      } catch (e) {
        if (!cancelled) console.error("Failed to fetch users", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page]);

  const totalPages = Math.ceil(total / pageSize);

  const handleSaved = () => {
    setShowCreate(false);
    setEditUser(null);
    setPage(1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <PermissionGuard code="user:create">
          <Button onClick={() => setShowCreate(true)}>创建用户</Button>
        </PermissionGuard>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>邮箱</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>邮箱验证</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="w-16">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">加载中...</TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">暂无用户</TableCell></TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.first_name} {u.last_name}</TableCell>
                  <TableCell>{u.status}</TableCell>
                  <TableCell>{u.email_verified ? "是" : "否"}</TableCell>
                  <TableCell>{new Date(u.created_at).toLocaleDateString("zh-CN")}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <span className="inline-flex items-center justify-center size-8 rounded-md hover:bg-muted cursor-pointer text-sm">⋯</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <PermissionGuard code="user:update">
                          <DropdownMenuItem onClick={() => setEditUser(u)}>编辑</DropdownMenuItem>
                        </PermissionGuard>
                        <PermissionGuard code="user:delete">
                          <DropdownMenuItem onClick={() => setDeleteUser(u)} className="text-destructive">删除</DropdownMenuItem>
                        </PermissionGuard>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-muted-foreground">共 {total} 条</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页</Button>
          </div>
        </div>
      )}

      {showCreate && (
        <UserFormDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          onSaved={handleSaved}
        />
      )}
      {editUser && (
        <UserFormDialog
          open={!!editUser}
          onOpenChange={() => setEditUser(null)}
          onSaved={handleSaved}
          user={editUser}
        />
      )}
      {deleteUser && (
        <UserDeleteDialog
          open={!!deleteUser}
          onOpenChange={() => setDeleteUser(null)}
          onDeleted={() => setPage(1)}
          user={deleteUser}
        />
      )}
    </div>
  );
}