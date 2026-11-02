<script setup>
import { Link } from '@inertiajs/vue3';

// Parents of the current page only; the page's own title follows below it.
defineProps({
    items: { type: Array, default: () => [] },
});
</script>

<template>
    <nav v-if="items.length" class="crumbs" aria-label="Breadcrumb">
        <ol>
            <li v-for="(item, i) in items" :key="item.href ?? i">
                <Link v-if="item.href" :href="item.href">{{ item.label }}</Link>
                <span v-else>{{ item.label }}</span>
                <i class="pi pi-angle-right" aria-hidden="true" />
            </li>
        </ol>
    </nav>
</template>

<style scoped>
.crumbs ol { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem; font-size: 0.85rem; }
.crumbs li { display: inline-flex; align-items: center; gap: 0.25rem; min-width: 0; }
.crumbs a, .crumbs span { color: var(--p-text-muted-color); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 18rem; }
.crumbs a:hover { color: var(--p-text-color); text-decoration: underline; }
.crumbs i { font-size: 0.75rem; color: var(--p-text-muted-color); }
</style>
