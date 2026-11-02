<script setup>
import { Link, router } from '@inertiajs/vue3';
import ToggleSwitch from 'primevue/toggleswitch';

// Tracks, Videos and Photos are separate pages under one "Library" section;
// this strip switches between them and carries the "Not in an event" filter.
const props = defineProps({
    current: { type: String, required: true }, // tracks | videos | photos
    unfiled: { type: Boolean, default: false },
});

const tabs = [
    { key: 'tracks', label: 'Tracks', icon: 'pi pi-volume-up', route: 'tracks.index' },
    { key: 'videos', label: 'Videos', icon: 'pi pi-video', route: 'media.index' },
    { key: 'photos', label: 'Photos', icon: 'pi pi-image', route: 'media.photos' },
];

const href = (tab) => route(tab.route, props.unfiled ? { unfiled: 1 } : {});

const setUnfiled = (value) => {
    const tab = tabs.find((t) => t.key === props.current);
    router.get(route(tab.route), value ? { unfiled: 1 } : {}, { preserveState: false, preserveScroll: true });
};
</script>

<template>
    <div class="library-tabs">
        <nav class="tabs" aria-label="Library">
            <Link
                v-for="tab in tabs"
                :key="tab.key"
                :href="href(tab)"
                class="tab"
                :class="{ on: tab.key === current }"
                :aria-current="tab.key === current ? 'page' : undefined"
            >
                <i :class="tab.icon" aria-hidden="true" /> {{ tab.label }}
            </Link>
        </nav>
        <label class="unfiled">
            <ToggleSwitch :modelValue="unfiled" inputId="unfiled-toggle" @update:modelValue="setUnfiled" />
            <span>Not in an event</span>
        </label>
    </div>
</template>

<style scoped>
.library-tabs { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.tabs { display: flex; gap: 0.25rem; }
.tab { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.8rem; border-radius: 999px; text-decoration: none; color: var(--p-text-muted-color); font-weight: 500; font-size: 0.9rem; }
.tab:hover { color: var(--p-text-color); background: var(--p-content-hover-background); }
.tab.on { color: var(--p-primary-contrast-color); background: var(--p-primary-color); }
.unfiled { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--p-text-muted-color); cursor: pointer; }
</style>
