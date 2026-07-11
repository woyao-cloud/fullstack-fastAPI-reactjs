import { RegisterForm } from "@/components/auth/register-form";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <RegisterForm />
        <p className="mt-4 text-sm">
          已有账号? <Link href="/login" className="underline">去登录</Link>
        </p>
      </div>
    </div>
  );
}
