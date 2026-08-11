package com.product.service.read;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.domain.entity.Category;
import com.product.domain.entity.Sku;
import com.product.domain.entity.Spu;
import com.product.domain.entity.SpuStatus;
import com.product.dto.request.ProductSearchRequest;
import com.product.repository.SpuRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProductQueryServiceTest {
    @Mock SpuRepository spuRepository;
    ProductQueryService service;

    @BeforeEach
    void setUp() { service = new ProductQueryService(spuRepository, new ObjectMapper()); }

    @Test
    void shouldSearchByName() {
        var req = new ProductSearchRequest("iPhone", null, null, null, null, null, 0, 10);
        when(spuRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(newActiveSpu()), PageRequest.of(0, 10), 1));
        var result = service.search(req);
        assertThat(result.total()).isEqualTo(1);
        assertThat(result.items()).hasSize(1);
        assertThat(result.items().get(0).name()).isEqualTo("iPhone 16");
    }

    @Test
    void shouldReturnDetailWithDeserializedJsonFields() {
        var spu = newActiveSpu();
        spu.setImages("[\"http://img/a.jpg\"]");
        spu.setSpecsTemplate("[{\"key\":\"颜色\",\"values\":[\"黑\",\"白\"]}]");
        spu.setTags("[\"热卖\"]");
        var sku = new Sku();
        sku.setId(UUID.randomUUID());
        sku.setSpu(spu);
        sku.setSpecs("{\"颜色\":\"黑\"}");
        sku.setPrice(new BigDecimal("5999.00"));
        sku.setSkuCode("SKU-001");
        sku.setImages("[\"http://img/sku.jpg\"]");
        sku.setActive(true);
        spu.setSkus(List.of(sku));

        when(spuRepository.findByIdWithSkus(spu.getId())).thenReturn(Optional.of(spu));

        var result = service.detail(spu.getId());

        assertThat(result.name()).isEqualTo("iPhone 16");
        assertThat(result.category().slug()).isEqualTo("phone");
        assertThat(result.images()).containsExactly("http://img/a.jpg");
        assertThat(result.specsTemplate().get(0).key()).isEqualTo("颜色");
        assertThat(result.tags()).containsExactly("热卖");
        assertThat(result.skus()).hasSize(1);
        assertThat(result.skus().get(0).specs()).containsEntry("颜色", "黑");
        assertThat(result.skus().get(0).available()).isZero();
    }

    @Test
    void shouldRejectMissingSpu() {
        when(spuRepository.findByIdWithSkus(any())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.detail(UUID.randomUUID()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("商品不存在");
    }

    private Spu newActiveSpu() {
        var spu = new Spu();
        spu.setId(UUID.randomUUID());
        spu.setName("iPhone 16");
        spu.setDescription("desc");
        spu.setStatus(SpuStatus.active);
        spu.setCoverImage("http://img/cover.jpg");
        spu.setImages("[]");
        spu.setSpecsTemplate("[]");
        spu.setTags("[]");
        var category = new Category();
        category.setId(UUID.randomUUID());
        category.setName("手机");
        category.setSlug("phone");
        category.setSortOrder(1);
        category.setActive(true);
        spu.setCategory(category);
        return spu;
    }
}
