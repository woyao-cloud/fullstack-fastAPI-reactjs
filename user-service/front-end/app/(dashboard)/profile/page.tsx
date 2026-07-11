"use client";
import { ProfileForm } from "@/components/profile/profile-form";
import { PasswordForm } from "@/components/profile/password-form";

export default function ProfilePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">个人中心</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProfileForm />
        <PasswordForm />
      </div>
    </div>
  );
}