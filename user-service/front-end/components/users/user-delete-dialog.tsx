"use client";
import { useState } from "react";
import { userApi } from "@/lib/api/users";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { UserOut } from "@/types/user";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
  user: UserOut;
}

export function UserDeleteDialog({ open, onOpenChange, onDeleted, user }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setLoading(true);
    setError("");
    try {
      await userApi.delete(user.id);
      onDeleted();
      onOpenChange(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>
            确定要删除用户 <strong>{user.email}</strong> 吗？此操作不可撤销。
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>取消</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>删除</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}