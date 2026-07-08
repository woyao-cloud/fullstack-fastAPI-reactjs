"""Gunicorn 配置: uvloop + UvicornWorker + 多 worker 调优.

启动方式:
    gunicorn app.main:app -c gunicorn.conf.py

开发环境(单 worker):
    gunicorn app.main:app -c gunicorn.conf.py --workers=1
"""

import multiprocessing
import os

# 绑定地址
bind = os.getenv("GUNICORN_BIND", "0.0.0.0:8000")

# Worker 进程数: 2-4 × CPU 核心数
# 默认: CPU 核心数 × 2 + 1
workers = int(os.getenv("GUNICORN_WORKERS", multiprocessing.cpu_count() * 2 + 1))

# 使用 UvicornWorker（ASGI）
worker_class = "uvicorn.workers.UvicornWorker"

# 每个 worker 的最大连接数（UvicornWorker 自动处理）
worker_connections = 1000

# 超时设置
timeout = int(os.getenv("GUNICORN_TIMEOUT", "120"))  # 请求超时（秒）
keepalive = int(os.getenv("GUNICORN_KEEPALIVE", "5"))  # 保持连接（秒）
graceful_timeout = int(os.getenv("GUNICORN_GRACEFUL_TIMEOUT", "30"))  # 优雅关闭超时

# 日志
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")
accesslog = "-"  # stdout
errorlog = "-"  # stdout
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# 进程管理
pidfile = os.getenv("GUNICORN_PIDFILE", "/tmp/gunicorn.pid")
daemon = False  # 前台运行（Docker 友好）

# 重启策略
max_requests = int(os.getenv("GUNICORN_MAX_REQUESTS", "10000"))  # 每个 worker 处理 N 请求后重启（防止内存泄漏）
max_requests_jitter = int(os.getenv("GUNICORN_MAX_REQUESTS_JITTER", "1000"))

# 预加载应用（加快启动速度）
preload_app = True


def on_starting(server):
    """启动时启用 uvloop。"""
    try:
        import uvloop
        uvloop.install()
    except ImportError:
        pass


def post_fork(server, worker):
    """Worker 创建后的日志。"""
    server.log.info("Worker spawned (pid: %s)", worker.pid)


def worker_int(worker):
    """Worker 收到 INT 信号时的日志。"""
    worker.log.info("Worker received INT (pid: %s)", worker.pid)
