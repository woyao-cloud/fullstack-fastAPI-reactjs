"use client";
import { useState, useEffect } from "react";
import { departmentApi } from "@/lib/api/departments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DepartmentTree } from "@/components/departments/department-tree";
import { DepartmentFormDialog } from "@/components/departments/department-form-dialog";
import { DepartmentMembers } from "@/components/departments/department-members";
import type { DepartmentOut, DepartmentTreeNode } from "@/types/user";

export default function DepartmentsPage() {
  const [tree, setTree] = useState<DepartmentTreeNode[]>([]);
  const [selectedDept, setSelectedDept] = useState<DepartmentOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await departmentApi.getTree();
        if (!cancelled) setTree(data);
      } catch (e) {
        if (!cancelled) console.error("Failed to fetch department tree", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSelect = async (id: string) => {
    try {
      const dept = await departmentApi.get(id);
      setSelectedDept(dept);
    } catch (e) {
      console.error("Failed to fetch department", e);
    }
  };

  const handleDelete = async () => {
    if (!selectedDept) return;
    try {
      await departmentApi.delete(selectedDept.id);
      setSelectedDept(null);
      setShowDeleteConfirm(false);
      window.location.reload();
    } catch (e) {
      console.error("Failed to delete department", e);
    }
  };

  const handleSaved = () => {
    setShowCreate(false);
    setShowEdit(false);
    setSelectedDept(null);
    window.location.reload();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">部门管理</h1>
        <Button onClick={() => setShowCreate(true)}>创建部门</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">部门结构</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : (
            <DepartmentTree tree={tree} selectedId={selectedDept?.id ?? null} onSelect={handleSelect} />
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">部门详情</h2>
            {selectedDept ? (
              <Card>
                <CardHeader>
                  <CardTitle>{selectedDept.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm"><span className="font-medium">代码：</span>{selectedDept.code}</p>
                  <p className="text-sm"><span className="font-medium">层级：</span>{selectedDept.level}</p>
                  <p className="text-sm"><span className="font-medium">路径：</span>{selectedDept.path}</p>
                  <p className="text-sm"><span className="font-medium">排序：</span>{selectedDept.sort_order}</p>
                  <p className="text-sm"><span className="font-medium">状态：</span>{selectedDept.status}</p>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={() => setShowEdit(true)}>编辑</Button>
                    <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>删除</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <p className="text-sm text-muted-foreground">请选择一个部门查看详情</p>
            )}
          </div>
          {selectedDept && <DepartmentMembers departmentId={selectedDept.id} />}
        </div>
      </div>

      {showCreate && (
        <DepartmentFormDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          onSaved={handleSaved}
          parentId={selectedDept?.id ?? null}
        />
      )}
      {showEdit && selectedDept && (
        <DepartmentFormDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          onSaved={handleSaved}
          department={selectedDept}
        />
      )}

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除部门 <strong>{selectedDept?.name}</strong> 吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>删除</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}