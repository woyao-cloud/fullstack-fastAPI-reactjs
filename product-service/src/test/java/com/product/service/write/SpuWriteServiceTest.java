package com.product.service.write;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.domain.entity.Category;
import com.product.domain.entity.Spu;
import com.product.dto.request.SkuRequest;
import com.product.dto.request.SpuCreateRequest;
import com.product.repository.BrandRepository;
import com.product.repository.CategoryRepository;
import com.product.repository.SkuRepository;
import com.product.repository.SpuRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SpuWriteServiceTest {
    @Mock SpuRepository spuRepository;
    @Mock CategoryRepository categoryRepository;
    @Mock BrandRepository brandRepository;
    @Mock SkuRepository skuRepository;
    SpuWriteService service;

    @BeforeEach
    void setUp() { service = new SpuWriteService(spuRepository, categoryRepository, brandRepository, skuRepository, new ObjectMapper()); }

    @Test
    void shouldCreateSpuWithSkus() {
        var category = new Category(); category.setId(UUID.randomUUID());
        var req = new SpuCreateRequest("iPhone 16", "desc", category.getId(), null,
                null, List.of(), List.of(), List.of("热卖"),
                List.of(new SkuRequest(Map.of("颜色", "黑"), new BigDecimal("5999.00"),
                        "SKU-001", null, null, null, null)));
        when(categoryRepository.findById(category.getId())).thenReturn(Optional.of(category));
        when(spuRepository.save(any())).thenAnswer(inv -> { Spu s = inv.getArgument(0); s.setId(UUID.randomUUID()); return s; });
        when(skuRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service.create(req);

        assertThat(result.name()).isEqualTo("iPhone 16");
        assertThat(result.skus()).hasSize(1);
    }

    @Test
    void shouldRejectMissingCategory() {
        var req = new SpuCreateRequest("X", null, UUID.randomUUID(), null, null,
                List.of(), List.of(), List.of(), List.of());
        when(categoryRepository.findById(any())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("分类不存在");
    }

    @Test
    void shouldReturnCompleteResponseWithDeserializedJsonFields() {
        var category = new Category(); category.setId(UUID.randomUUID());
        var images = List.of("http://img/a.jpg", "http://img/b.jpg");
        var specsTemplate = List.of(new SpuCreateRequest.SpecTemplate("颜色", List.of("黑", "白")));
        var req = new SpuCreateRequest("iPhone 16", "desc", category.getId(), null,
                null, images, specsTemplate, List.of("热卖"),
                List.of(new SkuRequest(Map.of("颜色", "黑"), new BigDecimal("5999.00"),
                        "SKU-001", null, null, images, null)));
        when(categoryRepository.findById(category.getId())).thenReturn(Optional.of(category));
        when(spuRepository.save(any())).thenAnswer(inv -> { Spu s = inv.getArgument(0); s.setId(UUID.randomUUID()); return s; });
        when(skuRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service.create(req);

        assertThat(result.category()).isNotNull();
        assertThat(result.category().id()).isEqualTo(category.getId());
        assertThat(result.images()).containsExactlyElementsOf(images);
        assertThat(result.specsTemplate()).hasSize(1);
        assertThat(result.specsTemplate().get(0).key()).isEqualTo("颜色");
        assertThat(result.specsTemplate().get(0).values()).containsExactly("黑", "白");
        assertThat(result.tags()).containsExactly("热卖");
        assertThat(result.skus()).hasSize(1);
        assertThat(result.skus().get(0).specs()).containsEntry("颜色", "黑");
        assertThat(result.skus().get(0).images()).containsExactlyElementsOf(images);
    }
}
