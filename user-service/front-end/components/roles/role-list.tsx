"use client";
import { useState, useEffect, useCallback } from "react";
import { roleApi } from "@/lib/api/roles";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RoleFormDialog } from "./role-form-dialog";
import type { PermissionOut, RoleOut } from "@/types/user";

export function RoleList() {
  const [roles, setRoles] = useState<RoleOut[]>([]);
  const [permissions, setPermissions] = useState<PermissionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [editRole, setEditRole] = useState<RoleOut | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteRole, setDeleteRole] = useState<RoleOut | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesData, permsData] = await Promise.all([
        roleApi.list(),
        roleApi.listPermissions(),
      ]);
      setRoles(rolesData);
      setPermissions(permsData);
    } catch (e) {
      console.error("Failed to fetch roles", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const handleDelete = async () => {
    if (!deleteRole) return;
    try {
      await roleApi.delete(deleteRole.id);
      setDeleteRole(null);
      fetchRoles();
    } catch (e) {
      console.error("Failed to delete role", e);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">角色管理</h1>
        <Button onClick={() => setShowCreate(true)}>创建角色</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>代码</TableHead>
              <TableHead>数据范围</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>权限</TableHead>
              <TableHead className="w-16">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">加载中...</TableCell></TableRow>
            ) : roles.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">暂无角色</TableCell></TableRow>
            ) : (
              roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.code}</TableCell>
                  <TableCell>{r.data_scope}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {r.permissions.slice(0, 3).map((p) => (
                        <span key={p.id} className="inline-block bg-muted px-1.5 py-0.5 rounded text-xs">{p.code}</span>
                      ))}
                      {r.permissions.length > 3 && <span className="text-xs text-muted-foreground">+{r.permissions.length - 3}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button variant="ghost" size="icon">⋯</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditRole(r)}>编辑</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteRole(r)} className="text-destructive">删除</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {showCreate && (
        <RoleFormDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          onSaved={() => { setShowCreate(false); fetchRoles(); }}
          allPermissions={permissions}
        />
      )}
      {editRole && (
        <RoleFormDialog
          open={!!editRole}
          onOpenChange={() => setEditRole(null)}
          onSaved={() => { setEditRole(null); fetchRoles(); }}
          role={editRole}
          allPermissions={permissions}
        />
      )}

      <Dialog open={!!deleteRole} onOpenChange={() => setDeleteRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除角色 <strong>{deleteRole?.name}</strong> 吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteRole(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>删除</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}