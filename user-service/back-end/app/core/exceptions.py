"""统一异常与全局异常处理."""

from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse


class BusinessException(HTTPException):
    """业务异常基类。"""

    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(status_code=status_code, detail=detail)


class NotFoundError(BusinessException):
    def __init__(self, detail: str = "资源不存在"):
        super().__init__(detail=detail, status_code=status.HTTP_404_NOT_FOUND)


class ConflictError(BusinessException):
    def __init__(self, detail: str = "资源冲突"):
        super().__init__(detail=detail, status_code=status.HTTP_409_CONFLICT)


class AuthError(BusinessException):
    def __init__(self, detail: str = "认证失败"):
        super().__init__(detail=detail, status_code=status.HTTP_401_UNAUTHORIZED)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(BusinessException)
    async def _business(_: Request, exc: BusinessException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "code": exc.status_code, "message": exc.detail},
        )

    @app.exception_handler(HTTPException)
    async def _http(_: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "code": exc.status_code, "message": exc.detail},
        )