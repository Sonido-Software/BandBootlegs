<script setup>
import { newContext } from '@/lib/newActions';

// The options behind "+ New". File options are <label>s for inputs the layout
// keeps mounted: a tap on a label opens the native picker directly, which phones
// honour where a scripted .click() on a hidden input is sometimes ignored.
defineProps({
    inputIds: { type: Object, required: true },
});

const emit = defineEmits(['create', 'picked']);
</script>

<template>
    <div class="new-menu">
        <p class="target">
            <i class="pi pi-arrow-down-right" aria-hidden="true" />
            Uploads go to <strong>{{ newContext.target || 'your library' }}</strong>
        </p>
        <label :for="inputIds.tracks" class="opt" @click="emit('picked')">
            <span class="ico"><i class="pi pi-volume-up" /></span>
            <span><b>Upload tracks</b><small>Multitrack .wav files</small></span>
        </label>
        <label :for="inputIds.stitch" class="opt" @click="emit('picked')">
            <span class="ico"><i class="pi pi-objects-column" /></span>
            <span><b>Stitch &amp; split</b><small>Several .wav chunks from one recording</small></span>
        </label>
        <label :for="inputIds.media" class="opt" @click="emit('picked')">
            <span class="ico"><i class="pi pi-images" /></span>
            <span><b>Photos &amp; videos</b><small>From this device</small></span>
        </label>
        <hr />
        <button type="button" class="opt" @click="emit('create', 'event')">
            <span class="ico"><i class="pi pi-calendar-plus" /></span>
            <span><b>New event</b></span>
        </button>
        <button type="button" class="opt" @click="emit('create', 'collection')">
            <span class="ico"><i class="pi pi-folder-plus" /></span>
            <span><b>New collection</b></span>
        </button>
    </div>
</template>

<style scoped>
.new-menu { display: flex; flex-direction: column; min-width: 17rem; }
.target { margin: 0 0 0.4rem; padding: 0 0.5rem; font-size: 0.8rem; color: var(--p-text-muted-color); display: flex; align-items: center; gap: 0.4rem; }
.target strong { color: var(--p-text-color); font-weight: 600; }
.opt { display: flex; align-items: center; gap: 0.75rem; padding: 0.55rem 0.5rem; border-radius: 6px; cursor: pointer; background: none; border: 0; font: inherit; color: inherit; text-align: left; width: 100%; }
.opt:hover, .opt:focus-visible { background: var(--p-content-hover-background); outline: none; }
.opt b { display: block; font-weight: 600; font-size: 0.9rem; }
.opt small { display: block; font-size: 0.75rem; color: var(--p-text-muted-color); }
.ico { flex: none; width: 2rem; height: 2rem; border-radius: 8px; display: grid; place-items: center; background: var(--p-primary-50); color: var(--p-primary-color); }
:global(.dark) .ico { background: color-mix(in srgb, var(--p-primary-color) 18%, transparent); }
hr { border: 0; border-top: 1px solid var(--p-content-border-color); margin: 0.35rem 0; width: 100%; }
</style>
