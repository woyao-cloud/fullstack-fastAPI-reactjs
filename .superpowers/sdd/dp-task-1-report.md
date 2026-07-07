# Task 1 Report: User.created_by 字段 + UserService.create 接 actor

## Status: DONE

## Commit
- SHA: `d5b562aa364e2c16a47fc03f53e15b45a2101c13`
- Subject: `feat(dataperm): User.created_by 字段 + create 接 actor`
- Branch: `feat/data-permission`

## Changes

### 1. `app/domain/models/user.py`
Added `created_by` self-referential FK column after `last_login_at`, before `roles` relationship:
```python
created_by: Mapped[uuid.UUID | None] = mapped_column(
    UUIDType, ForeignKey("user_account.id"), nullable=True, index=True
)
```
- Nullable (system-created users have no creator)
- Indexed (for data-permission filtering by creator)
- Self-referential FK to `user_account.id`

### 2. `app/application/services/user_service.py`
Modified `UserService.create` signature to accept optional `actor`:
```python
async def create(self, req: UserCreate, actor: User | None = None) -> User:
```
Sets `created_by=actor.id if actor is not None else None` on the new User.

### 3. `app/interfaces/api/users.py`
Changed `create_user` route to inject `current_user` via `require_permission("user:create")` (which returns the current `User` per `app/core/security.py` `_checker`) and pass `actor=current_user`:
```python
async def create_user(
    req: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("user:create")),
) -> UserOut:
    service = UserService(db)
    return UserOut.model_validate(await service.create(req, actor=current_user))
```

### 4. `tests/test_data_permission.py` (new)
Two tests per brief:
- `test_create_sets_created_by`: actor creates child user, asserts `created.created_by == actor.id`
- `test_create_without_actor_has_no_created_by`: actor=None, asserts `u.created_by is None`

## Testing

### TDD flow verified
- Step 2 (before impl): `uv run pytest tests/test_data_permission.py -v` → 2 failed with `TypeError: UserService.create() got an unexpected keyword argument 'actor'` (expected failure confirms tests drive the implementation).
- Step 6 (after impl): `uv run pytest tests/test_data_permission.py -v` → 2 passed.
- Full suite: `uv run pytest` → **116 passed, 100 warnings in 31.27s**. No regressions.

### Notes
- Pre-existing warnings (PytestWarning about sync tests marked asyncio, SAWarning about FK cycle department↔user_account on SQLite DROP) are unrelated to this task — they existed before and are not caused by the new `created_by` column. The self-referential FK to `user_account.id` does not introduce a new DROP-order cycle (single-table self-reference is handled fine).
- `register` route in `app/interfaces/api/auth.py` was confirmed unchanged — it uses `AuthService.register`, which does not call `UserService.create` with an actor, so `created_by=None` for self-registered users (per brief note: "确认无需改").

## Self-Review

### Completeness
- [x] `created_by` column: FK + nullable + index — present
- [x] `UserService.create(actor)` sets `created_by` correctly (None when actor is None, actor.id when provided)
- [x] `create_user` route passes `actor=current_user` via `Depends(require_permission("user:create"))` — confirmed `require_permission` returns the current user (security.py lines 82-96, `_checker` returns `current_user`)

### Quality / Discipline
- Minimal edits per brief: exactly 3 modified files + 1 new test file
- Verbatim code from brief used
- No over-engineering; no extra fields or methods

### Testing
- Real SQLite async engine via existing `engine`/`seed` conftest fixtures
- Test output pristine (only pre-existing unrelated warnings)
- Both new tests pass; full 116-test suite green

## SKILLs / plugins / agents used
- None invoked (standard TDD workflow with built-in Read/Edit/Write/Bash/PowerShell tools).

## Concerns
None.