import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema } from "@/lib/schemas/auth";

describe("loginSchema", () => {
  it("accepts valid email and password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "12345678" }).success).toBe(true);
  });
  it("rejects invalid email", () => {
    expect(loginSchema.safeParse({ email: "not-email", password: "12345678" }).success).toBe(false);
  });
  it("rejects short password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "123" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("rejects password mismatch", () => {
    const r = registerSchema.safeParse({
      email: "a@b.com", password: "12345678", confirmPassword: "87654321",
      first_name: "A", last_name: "B",
    });
    expect(r.success).toBe(false);
  });
  it("accepts valid registration", () => {
    expect(registerSchema.safeParse({
      email: "a@b.com", password: "12345678", confirmPassword: "12345678",
      first_name: "Alice", last_name: "Wang",
    }).success).toBe(true);
  });
});
