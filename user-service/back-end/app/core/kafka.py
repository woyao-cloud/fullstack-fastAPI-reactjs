"""Kafka 异步生产者 + 生命周期管理."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from app.core.config import settings

logger = logging.getLogger(__name__)

AUDIT_LOG_TOPIC = "audit_logs"


class KafkaProducer:
    """Kafka 异步生产者包装，支持优雅关闭。"""

    def __init__(self) -> None:
        self._producer = None
        self._started = False

    async def start(self) -> None:
        if self._started:
            return
        try:
            from aiokafka import AIOKafkaProducer

            self._producer = AIOKafkaProducer(
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                client_id="um-audit",
                max_request_size=1048576,
                compression_type="gzip",
            )
            await self._producer.start()
            self._started = True
            logger.info("Kafka producer 已启动: %s", settings.KAFKA_BOOTSTRAP_SERVERS)
        except Exception as exc:
            logger.warning("Kafka 不可用,审计日志降级为直写 DB: %s", exc)
            self._started = False

    async def send_audit_log(self, log_data: dict) -> bool:
        """异步发送审计日志到 Kafka,失败降级(不抛异常)。"""
        if not self._started or self._producer is None:
            return False
        try:
            await self._producer.send_and_wait(
                AUDIT_LOG_TOPIC,
                json.dumps(log_data, default=str).encode("utf-8"),
            )
            return True
        except Exception as exc:
            logger.warning("Kafka 发送审计日志失败,降级: %s", exc)
            return False

    async def stop(self) -> None:
        if self._producer is not None and self._started:
            try:
                await self._producer.stop()
                logger.info("Kafka producer 已关闭")
            except Exception as exc:
                logger.warning("Kafka producer 关闭异常: %s", exc)
            finally:
                self._started = False


_kafka_singleton: KafkaProducer | None = None


async def get_kafka_producer() -> KafkaProducer:
    """获取 Kafka producer 单例。"""
    global _kafka_singleton
    if _kafka_singleton is None:
        _kafka_singleton = KafkaProducer()
        await _kafka_singleton.start()
    return _kafka_singleton


async def close_kafka_producer() -> None:
    """关闭 Kafka producer。"""
    global _kafka_singleton
    if _kafka_singleton is not None:
        await _kafka_singleton.stop()
        _kafka_singleton = None