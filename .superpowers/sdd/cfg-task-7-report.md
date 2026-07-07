# Task 7 Report: ConfigService (CRUD + 分组校验 + 加解密 + 历史 + 缓存)

## Status: DONE

## What Implemented

Created `app/application/services/config_service.py` per brief verbatim:
- `ConfigService(db, repo, history_repo, crypto, cache)` constructor
- `get_group(group)` — Cache Aside pattern (cache.get_group → load → cache.set_group)
- `get_value(key)` — resolves via group, raises NotFoundError if missing field
- `set_value(key, value, updated_by)` — load group → validate via GROUP_MODELS model → SECRET encrypt → upsert → write ConfigHistory → commit → cache.invalidate(group)
- `create_or_init(...)` — idempotent init (no-op if key exists)
- `init_default_configs(updated_by)` — seeds all 4 groups from `_DEFAULTS`, then invalidates whole cache
- `list_groups()` and `list_keys(group=None)`
- Helpers: `_DEFAULTS`, `_infer_type`, `_TYPES`, `_cast_value`, `_to_storage`, `_from_storage`

SECRET fields detected via `model_cls.model_fields[k].annotation` containing "SecretStr" → wrapped in `pydantic.SecretStr` before validation. Key→group mapping via `group_of_key`; field name = key with prefix stripped.

## Test Results (TDD)

- RED: ModuleNotFoundError on first run (module absent) — collected 0, 1 error
- GREEN: `uv run pytest tests/test_config_service.py -v` → **8 passed, 8 warnings in 2.77s**
- Full suite: `uv run pytest` → **100 passed, 86 warnings in 35.59s** (no regression)

Tests use real SQLite async engine + real Fernet (monkeypatched CONFIG_ENCRYPTION_KEY) + spy cache subclass. Coverage:
1. `test_init_default_configs_seeds_all` — 4 groups seeded
2. `test_init_idempotent` — re-run doesn't overwrite
3. `test_set_value_validates_group` — password_min_length=3 → BusinessException
4. `test_set_value_secret_encrypts` — DB ciphertext, get_value decrypts, history ciphertext
5. `test_get_group_returns_real_values` — site_name present
6. `test_set_value_records_history` — exactly 1 history row with new_value="NewName"
7. `test_unknown_group_rejected` — `unknown.x` → BusinessException
8. `test_cache_invalidation_on_set` — spy.invalidated contains "SYSTEM"

## Files Changed

- Created: `app/application/services/config_service.py` (152 lines)
- Created: `tests/test_config_service.py` (118 lines)
- Commit SHA: `58d3bd19bf6f1ce811f21232f2e4a535976ccc1d`
- Subject: `feat(config): ConfigService(CRUD/分组校验/加解密/历史/缓存)`

## Self-Review

| Requirement | Status |
|---|---|
| get_group Cache Aside (cache miss → load → set) | OK |
| get_value (decrypt, NotFoundError on missing) | OK |
| set_value: load group → validate → encrypt SECRET → upsert → history → commit → invalidate | OK |
| create_or_init idempotent | OK |
| init_default_configs seeds all 4 groups | OK |
| list_groups / list_keys | OK |
| Tests use real DB + real Fernet + spy cache | OK |
| No regression in full suite | OK (100 passed) |
| Output pristine (no extra print/logging spam) | OK |
| Discipline: TDD RED→GREEN, single new file, no over-engineering, no email template logic | OK |

## Brief-Code Deviations

None. Brief code was followed verbatim and passed all tests without modification. The `DepartmentCache` import marked `# noqa: F401` is unused in the service but kept per brief (claimed "避免循环" rationale).

## Concerns

- The `DepartmentCache` import in the service is genuinely unused; kept verbatim per brief.
- `set_value` commits inside the service (same as brief). Callers cannot wrap multiple `set_value` calls in one transaction. Acceptable for config writes (low frequency) but worth noting.
- `_TYPES` is inferred only from `_DEFAULTS`; a new key created via `create_or_init` outside defaults will fall back to "STRING" type in `set_value` — acceptable per brief intent.
- `_load_group_dict` reads DB on every `set_value` (needed to assemble validation group) — fine given config write frequency.

## Skills/Plugins/Agents Used

- Direct file Read/Write/Edit tools (no subagent delegation needed)
- Skill invoked: `superpowers:test-driven-development` (RED→GREEN discipline followed)
- No plugins, no other agents
## Fix Report (C7 Review Cleanup) — 2026-07-06

Commit: 24a8981 `fix(config): ConfigService 清理(删除错误 DepartmentCache import + SecretStr 提顶 + _PREFIX 复用 + list_keys 返回类型)`

### Changes per finding

1. **Wrong import (defect):** Deleted `from app.core.cache import DepartmentCache  # noqa: F401` (line ~13). `DepartmentCache` is the DEPT module's cache Protocol, unused in this file.
2. **Inline import in loop:** Moved `from pydantic import SecretStr` to module-top imports (between `from typing import Any` and `from sqlalchemy.ext.asyncio import AsyncSession`). Removed the in-loop `from pydantic import SecretStr` inside `set_value`'s `for k, v` loop body.
3. **DRY:** Removed local `prefix_map` dict in `init_default_configs`; now uses module-level `_PREFIX` dict directly (`key = f"{_PREFIX[group]}.{field}"`).
4. **Return type:** `list_keys` return annotation changed from bare `list` to `list[SystemConfig]`. Added `from app.domain.models.system_config import SystemConfig` to module-top imports.

### Additional cleanup (incidental, required by ruff)
- Sorted import block (ruff I001 auto-fix) — `app.domain.models.system_config` placed in correct alphabetical position after `app.core.exceptions`.
- Wrapped long line in `create_or_init` (ruff E501, 103 -> <100 chars) — `await self.repo.upsert(...)` split across two lines. Pre-existing issue, trivial cosmetic, no logic change.

### Test results
- `uv run pytest tests/test_config_service.py -v` -> **8 passed**.
- `uv run pytest` (full suite) -> **100 passed**, no regression.

### Ruff result
- `uv run ruff check app/application/services/config_service.py` -> **All checks passed** (0 errors).
- `uv run ruff check app tests` -> 15 errors remain, all **pre-existing in test files** (out of scope: import sorting / unused `SystemConfig` in `tests/test_system_config_repository.py`, etc.). Before this commit: 17 errors; after: 15 (net -2 — removed bad `DepartmentCache` F401 noqa + fixed I001 in config_service). No new lint issues introduced.

### Out of scope (not fixed, per task instructions)
- `_TYPES` STRING fallback for non-default keys.
- Trailing newline (cosmetic).
