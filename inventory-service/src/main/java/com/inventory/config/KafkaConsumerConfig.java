package com.inventory.config;

import com.inventory.event.OrderEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

@Configuration
public class KafkaConsumerConfig {

    private static final Logger log = LoggerFactory.getLogger(KafkaConsumerConfig.class);

    // 毒消息(反序列化失败/未知枚举等)在监听方法外失败, 默认无 DLT 会无限重投阻塞整个分区。
    // 用 DefaultErrorHandler 重试(10 次, 1s 间隔)后 recoverer 记日志并提交 offset, 跳过毒消息。
    @Bean
    ConcurrentKafkaListenerContainerFactory<String, OrderEvent> kafkaListenerContainerFactory(
            ConsumerFactory<String, OrderEvent> consumerFactory) {
        var factory = new ConcurrentKafkaListenerContainerFactory<String, OrderEvent>();
        factory.setConsumerFactory(consumerFactory);
        factory.setCommonErrorHandler(new DefaultErrorHandler(
                (rec, ex) -> log.error("毒事件已跳过(重试耗尽) topic={} offset={} cause={}",
                        rec.topic(), rec.offset(), ex.getMessage()),
                new FixedBackOff(1000L, 9)));
        return factory;
    }
}
