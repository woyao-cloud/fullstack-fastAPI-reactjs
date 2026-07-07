# Task 5 Report: 全量回归 + 覆盖率 + ruff

## Status: DONE

## Acceptance Criteria

| Criterion | Target | Actual | Pass |
|---|---|---|---|
| All tests passing | 100% | 131/131 | Yes |
| `data_permission_filter.py` coverage | >=90% | 97% (39 stmts, 1 miss) | Yes |
| TOTAL coverage | >=85% | 90% (1552 stmts, 160 missed) | Yes |
| ruff check | 0 errors | 0 errors | Yes |

## Ruff Before/After

**Before**: 33 errors
- F401: 2 unused imports (`select` in `data_permission_filter.py`, `Department` in `test_data_permission.py`)
- E402: 7 mid-file imports in `test_data_permission.py`
- E702: 19 semicolons in `test_data_permission.py`
- E501: 3 line-length violations (`user_service.py:56`, `user_repository.py:38`, `test_data_permission.py:150`)
- F841: 2 unused variables (`a`, `b`) in `test_data_permission.py`

**After**: 0 errors

## Files Changed

| File | Change |
|---|---|
| `app/application/services/data_permission_filter.py` | Removed unused `select` import |
| `app/application/services/user_service.py` | Split long `list()` signature for E501 |
| `app/repositories/user_repository.py` | Split long `list_from_stmt()` signature for E501 |
| `tests/test_data_permission.py` | Consolidated imports at top, removed mid-file imports, split semicolons to separate lines, removed unused variables |

## Self-Review

- **Completeness**: All 131 tests pass, coverage >=85% total and >=90% for `data_permission_filter`, ruff 0 errors.
- **Quality**: All changes are lint-only (import cleanup, line-length reformatting, semicolon removal). No logic changes.
- **Discipline**: No speculative tests added — coverage already met targets without additional tests.

## Commit

```
8113c59 test(dataperm): 全量回归通过,覆盖率>=85%,ruff 清零
```

Branch: `feat/data-permission`

## Fix Report: Remove dead `self.db` in DataPermissionFilter

- **Finding**: `self.db = db` in `data_permission_filter.py` line 18 was dead code — `self.db` never read by any method.
- **Fix**: Removed `self.db = db` assignment; kept `self.dept_repo = dept_repo`.
- **Tests**: `tests/test_data_permission.py` 14/14 PASS; full suite 131/131 PASS, no regression.
- **Commit**: `1e697df fix(dataperm): 移除 DataPermissionFilter 未使用的 self.db`
