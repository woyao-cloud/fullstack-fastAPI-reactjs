# Security Review Report

**Scope:** Full project — `back-end/` (FastAPI, Docker, configs) and `front-end/` (Next.js 16, React 19, Zustand)  
**Review Date:** 2026-07-09  
**Risk Level:** HIGH  
**Files Reviewed:** 156 tracked source files  
**Reviewer:** Security Reviewer (Automated Agent)

扫描结果：27 项发现
┌─────────────┬──────┬────────────────────────────────────────────────────────────────────────────────────────────┐
│   严重度    │ 数量 │                                          关键问题                                          │
├─────────────┼──────┼────────────────────────────────────────────────────────────────────────────────────────────┤
│ 🔴 CRITICAL │ 5    │ JWT 密钥硬编码、CORS 配置错误、数据库密码硬编码、refresh token 存 localStorage、加密密钥弱 │
├─────────────┼──────┼────────────────────────────────────────────────────────────────────────────────────────────┤
│ 🟠 HIGH     │ 8    │ 无速率限制、无安全头、Docker 以 root 运行、Redis/Kafka 无认证                              │
├─────────────┼──────┼────────────────────────────────────────────────────────────────────────────────────────────┤
│ 🟡 MEDIUM   │ 10   │ npm 漏洞、无账户锁定、console.error 暴露信息、OpenAPI 暴露                                 │
├─────────────┼──────┼────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⚪ LOW      │ 4    │ 邮箱密码默认值、侧边栏未按权限隐藏等                                                       │
└─────────────┴──────┴────────────────────────────────────────────────────────────────────────────────────────────┘

最紧急的 3 件事：
1. 生产环境覆盖所有默认密钥（JWT/DB/Fernet）
2. CORS 配置修复（allow_origins=["*"] + allow_credentials=True 被浏览器拒绝）
3. Refresh token 迁移到 httpOnly cookie（当前存 localStorage 易被 XSS 窃取）
---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 5 |
| HIGH | 8 |
| MEDIUM | 10 |
| LOW | 4 |
| **Total** | **27** |

---

## Critical Issues (Fix Immediately)

### 1. Hardcoded JWT Secret Key in Default Config

**Severity:** CRITICAL  
**Category:** A02: Cryptographic Failures  
**Location:** `back-end/app/core/config.py:32`, `docker-compose.yml:68`, `k8s/secrets.yaml:10`  
**Issue:** Default `JWT_SECRET_KEY` is `"change-me-in-production"`. If not overridden, attacker can forge JWT tokens.  
**Remediation:** Set to `""` and add startup validation. Never use the default in production.

---

### 2. CORS `allow_origins=["*"]` with `allow_credentials=True`

**Severity:** CRITICAL  
**Category:** A01: Broken Access Control / A05: Security Misconfiguration  
**Location:** `back-end/app/main.py:72-77`  
**Issue:** Browsers reject this combination per CORS spec. Signals fundamental misunderstanding of CORS.  
**Remediation:** Set explicit allowed origins (e.g., `["http://localhost:3000"]`) instead of wildcard.

---

### 3. Hardcoded Database Password in Multiple Files

**Severity:** CRITICAL  
**Category:** A02: Cryptographic Failures  
**Location:** `docker-compose.yml:14`, `k8s/secrets.yaml:8`  
**Issue:** PostgreSQL password hardcoded in plaintext across multiple files.  
**Remediation:** Use `.env.example` with placeholders. Remove port exposure in production.

---

### 4. Refresh Token Stored in localStorage (XSS-Vulnerable)

**Severity:** CRITICAL  
**Category:** A07: Identification and Authentication Failures  
**Location:** `front-end/stores/auth.ts:50,69,76,89,96`  
**Issue:** Refresh token in localStorage is exposed to any XSS attack.  
**Remediation:** Use httpOnly, Secure, SameSite=Strict cookies for refresh tokens.

---

### 5. Hardcoded CONFIG_ENCRYPTION_KEY with Weak Placeholder

**Severity:** CRITICAL  
**Category:** A02: Cryptographic Failures  
**Location:** `docker-compose.yml:69`, `k8s/secrets.yaml:11`  
**Issue:** Fernet encryption key placeholder is weak.  
**Remediation:** Add `@field_validator` to reject empty/invalid Fernet keys at startup.

---

## High Issues (Fix Within 1 Week)

| # | Issue | Location | Remediation |
|---|-------|----------|-------------|
| 6 | No rate limiting on auth endpoints | `auth.py:25-43` | Add `slowapi` limiter (5/min login, 3/hr register) |
| 7 | No security headers | `main.py:63-90`, `next.config.ts` | Add CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| 8 | No CSRF protection | `main.py:63-90` | Require custom header or use `fastapi-csrf-protect` |
| 9 | Docker containers running as root | All Dockerfiles | Add `USER appuser` directive |
| 10 | No K8s security contexts | `k8s/*.yaml` | Add `runAsNonRoot: true`, drop ALL capabilities |
| 11 | Dockerfile hardcoded pip install | `Dockerfile:13` | Use `pip install .` from pyproject.toml |
| 12 | Redis without authentication | `docker-compose.yml`, `k8s/` | Add `--requirepass ${REDIS_PASSWORD}` |
| 13 | No refresh token reuse detection | `auth_service.py:72-86` | Implement token family rotation with reuse detection |

---

## Medium Issues (Fix Within 1 Month)

| # | Issue | Location | Remediation |
|---|-------|----------|-------------|
| 14 | npm audit: PostCSS XSS | `package.json` | Monitor Next.js update |
| 15 | No account lockout | `auth_service.py:58-70` | Check `failed_login_attempts` against `login_max_attempts` |
| 16 | No password history | `auth_service.py:88-98` | Store history, check against last N hashes |
| 17 | `console.error` in production | Multiple frontend files | Guard with `process.env.NODE_ENV !== "production"` |
| 18 | OpenAPI docs exposed | `main.py:67-68` | Disable `/docs` when `DEBUG=False` |
| 19 | No request body size limit | `main.py` | Add middleware for max body size (10MB) |
| 20 | Kafka without auth | `docker-compose.yml` | Configure SASL/SSL |
| 21 | Phone field no format validation | `schemas/auth.py:18` | Add E.164 regex pattern |
| 22 | PostgreSQL port exposed | `docker-compose.yml:15-16` | Remove port mapping in production |
| 23 | No structured security logging | All services | Add JSON-format logging for security events |

---

## Low Issues (Backlog)

| # | Issue | Location | Remediation |
|---|-------|----------|-------------|
| 24 | Email password default | `config_service.py:25` | Use empty default, force explicit config |
| 25 | Backend URL hardcoded | `next.config.ts:5` | Use environment variable |
| 26 | Sidebar ignores permissions | `sidebar.tsx:6-13` | Use `PermissionGuard` to hide inaccessible items |
| 27 | No Cache-Control on dashboard | `(dashboard)/*.tsx` | Add `no-store` header to authenticated pages |

---

## Remediation Priority

| Priority | Issue | Effort |
|----------|-------|--------|
| 1 | Rotate all hardcoded secrets (JWT, DB, Fernet) | 1h |
| 2 | Fix CORS misconfiguration | 15min |
| 3 | Move refresh token to httpOnly cookie | 4h |
| 4 | Add rate limiting on auth endpoints | 2h |
| 5 | Add security headers | 1h |
| 6 | Docker non-root + K8s securityContext | 2h |
| 7 | Add Redis/Kafka authentication | 1h |
| 8 | Implement account lockout | 2h |
| 9 | Add password history enforcement | 3h |
| 10 | Fix npm audit | Monitor |
| 11 | Minor fixes | 2h |
