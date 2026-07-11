package com.product.service.write;

import com.product.domain.entity.Category;
import com.product.dto.request.CategoryRequest;
import com.product.repository.CategoryRepository;
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
class CategoryWriteServiceTest {

    @Mock
    private CategoryRepository categoryRepository;

    private CategoryWriteService service;

    @BeforeEach
    void setUp() {
        service = new CategoryWriteService(categoryRepository);
    }

    @Test
    void shouldCreateCategory() {
        var request = new CategoryRequest("电子产品", "electronics", null, 0, null, true);
        when(categoryRepository.existsBySlug("electronics")).thenReturn(false);
        when(categoryRepository.save(any())).thenAnswer(inv -> {
            Category c = inv.getArgument(0);
            c.setId(UUID.randomUUID());
            return c;
        });

        var result = service.create(request);

        assertThat(result.name()).isEqualTo("电子产品");
        assertThat(result.slug()).isEqualTo("electronics");
    }

    @Test
    void shouldRejectDuplicateSlug() {
        var request = new CategoryRequest("电子产品", "electronics", null, 0, null, true);
        when(categoryRepository.existsBySlug("electronics")).thenReturn(true);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("slug");
    }

    @Test
    void shouldDeleteCategoryWithoutChildren() {
        UUID id = UUID.randomUUID();
        when(categoryRepository.existsByParentId(id)).thenReturn(false);
        when(categoryRepository.existsById(id)).thenReturn(true);

        service.delete(id);
    }

    @Test
    void shouldRejectDeleteCategoryWithChildren() {
        UUID id = UUID.randomUUID();
        when(categoryRepository.existsByParentId(id)).thenReturn(true);

        assertThatThrownBy(() -> service.delete(id))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("子分类");
    }
}
