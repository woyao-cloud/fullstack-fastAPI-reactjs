package com.product.service.write;

import com.product.domain.entity.Brand;
import com.product.dto.request.BrandRequest;
import com.product.repository.BrandRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BrandWriteServiceTest {

    @Mock
    private BrandRepository brandRepository;

    private BrandWriteService service;

    @BeforeEach
    void setUp() {
        service = new BrandWriteService(brandRepository);
    }

    @Test
    void shouldCreateBrand() {
        var request = new BrandRequest("Apple", null, "苹果公司", 0);
        when(brandRepository.existsByName("Apple")).thenReturn(false);
        when(brandRepository.save(any())).thenAnswer(inv -> {
            Brand b = inv.getArgument(0);
            b.setId(UUID.randomUUID());
            return b;
        });

        var result = service.create(request);

        assertThat(result.name()).isEqualTo("Apple");
        assertThat(result.description()).isEqualTo("苹果公司");
    }

    @Test
    void shouldRejectDuplicateName() {
        var request = new BrandRequest("Apple", null, null, 0);
        when(brandRepository.existsByName("Apple")).thenReturn(true);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("品牌名称");
    }
}
