"use client";
import { useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { userApi } from "@/lib/api/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProfileForm() {
  const user = useAuthStore((s) => s.user);
  const [first_name, setFirstName] = useState(user?.first_name ?? "");
  const [last_name, setLastName] = useState(user?.last_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMessage("");
    try {
      await userApi.update(user.id, { first_name, last_name, phone: phone || null });
      setMessage("保存成功");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>个人资料</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>邮箱</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="first_name">姓</Label>
            <Input id="first_name" value={first_name} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="flex-1">
            <Label htmlFor="last_name">名</Label>
            <Input id="last_name" value={last_name} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="phone">手机号</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        {message && <p className="text-sm text-green-600">{message}</p>}
        <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
      </CardContent>
    </Card>
  );
}