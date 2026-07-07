import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <LoginForm />
        <p className="mt-4 text-sm">
          还没有账号? <Link href="/register" className="underline">去注册</Link>
        </p>
      </div>
    </div>
  );
}
