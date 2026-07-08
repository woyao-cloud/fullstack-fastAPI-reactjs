"use client";
import { useState } from "react";
import api from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PasswordForm() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    setMessage("");
    if (newPassword !== confirmPassword) {
      setError("两次密码不一致");
      return;
    }
    if (newPassword.length < 8) {
      setError("密码至少 8 位");
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/change-password", { old_password: oldPassword, new_password: newPassword });
      setMessage("密码修改成功");
      setOldPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "修改失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>修改密码</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="old_password">当前密码</Label>
          <Input id="old_password" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="new_password">新密码</Label>
          <Input id="new_password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="confirm_password">确认新密码</Label>
          <Input id="confirm_password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {message && <p className="text-sm text-green-600">{message}</p>}
        <Button onClick={handleSubmit} disabled={saving}>{saving ? "修改中..." : "修改密码"}</Button>
      </CardContent>
    </Card>
  );
}