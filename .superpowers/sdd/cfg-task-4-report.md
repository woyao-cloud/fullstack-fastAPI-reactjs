# Task 4 Report: ConfigCache 协议 + LocalTTLCache + 工厂

## Status: DONE

## Commit
- SHA: `49cdfe61b878eec16578c57efd48f6115ffd5ffc`
- Subject: `feat(config): ConfigCache 协议 + LocalTTLCache + 工厂`
- Branch: `feat/system-config`

## Files
- Created: `app/core/config_cache.py`
- Test: `tests/test_config_cache.py`

## Implementation
Followed brief verbatim:
- `ConfigCache` Protocol with 4 async methods: `get_group`, `set_group`, `invalidate`, `start_subscriber`
- `LocalTTLCache` backed by `cachetools.TTLCache(maxsize=128, ttl=60)`
- `get_config_cache()` factory:
  - Returns local singleton when `CONFIG_CACHE_ENABLED=False`
  - Returns cached redis singleton if already built
  - Tries to import `RedisPubSubConfigCache` + `build_redis_client` from `app.core.redis_config_cache` (Task 5, not present) — import fails → falls back to local singleton with warning log
- `_local_singleton` is module-level (preserves cache state across calls)

## Tests
Target: 5 tests
```
tests/test_config_cache.py::test_local_cache_miss_and_set PASSED
tests/test_config_cache.py::test_local_cache_invalidate PASSED
tests/test_config_cache.py::test_local_cache_start_subscriber_noop PASSED
tests/test_config_cache.py::test_factory_returns_local_when_disabled PASSED
tests/test_config_cache.py::test_protocol_compat PASSED
```
Result: `5 passed, 1 warning in 0.07s` (warning is pre-existing `pytestmark asyncio on sync test` pattern, matches other tests in repo).

## Full Suite Regression Check
```
86 passed, 74 warnings in 32.76s
```
No regressions. All pre-existing tests still pass.

## TDD Process
1. Wrote `tests/test_config_cache.py` per brief (verbatim)
2. Ran `uv run pytest tests/test_config_cache.py -v` → `ModuleNotFoundError: No module named 'app.core.config_cache'` (FAIL, expected)
3. Created `app/core/config_cache.py` per brief (verbatim)
4. Ran tests → `5 passed`
5. Ran full suite → `86 passed`
6. Committed with required message

## Self-Review Checklist
- [x] Protocol has all 4 methods (`get_group`, `set_group`, `invalidate`, `start_subscriber`)
- [x] `LocalTTLCache`:
  - [x] Miss returns `None`
  - [x] `set_group` stores values
  - [x] `invalidate(group)` removes single, `invalidate()` clears all
  - [x] `start_subscriber` is a noop (`return None`)
- [x] Factory:
  - [x] Returns `LocalTTLCache` when `CONFIG_CACHE_ENABLED=False`
  - [x] Returns `LocalTTLCache` when Redis import fails (graceful degradation with warning log)
  - [x] Caches redis singleton to avoid rebuilding
- [x] `@runtime_checkable` enables `isinstance(LocalTTLCache(), ConfigCache)` check
- [x] Tests use real `TTLCache` behavior (no mocks)
- [x] No `redis_config_cache.py` created (Task 5 territory)
- [x] Used `settings.CONFIG_CACHE_ENABLED` from Task 2 (verified present at `app/core/config.py:41`)
- [x] `cachetools` already a dependency (per brief)

## Concerns
None. Implementation is brief-verbatim. The `pytestmark = pytest.mark.asyncio` warning on the sync `test_protocol_compat` test is the same pattern used in other tests in the repo (e.g., `test_department_schema.py`, `test_system_config_model.py`) — not introduced by this task.

## Skills/Plugins/Agents Used
- None invoked. Standard TDD workflow with Read/Write/PowerShell/Edit tools.