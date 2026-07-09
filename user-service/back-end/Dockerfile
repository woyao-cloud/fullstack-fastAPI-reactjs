# ============================================================
# 后端 Dockerfile — 单阶段构建
# ============================================================
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
# 先安装依赖（此时无源码，仅安装 pyproject.toml 声明的依赖）
RUN pip install --no-cache-dir uvicorn[standard] fastapi python-multipart sqlalchemy[asyncio] aiosqlite asyncpg alembic pydantic pydantic-settings email-validator "python-jose[cryptography]" "passlib[bcrypt]" "bcrypt<4.0.0" redis cachetools cryptography aiokafka

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
