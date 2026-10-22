<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Head, Link, router } from '@inertiajs/vue3';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Card from 'primevue/card';
import Message from 'primevue/message';
import Dialog from 'primevue/dialog';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import AddToCollectionMenu from '@/Components/AddToCollectionMenu.vue';

// Flat library of every video the user owns, across events. Uploads happen
// from an event page; this is for finding, sorting, and filing.
const props = defineProps({
    videos: { type: Array, required: true },
});

const confirm = useConfirm();

const formatBytes = (n) => {
    if (n == null) return '—';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
};

const formatDuration = (s) => {
    if (s == null) return '—';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
};

const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const confirmDelete = (item) => confirm.require({
    message: `Delete "${item.name}"? This cannot be undone.`,
    header: 'Delete video',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: () => router.delete(route('media.destroy', item.id), { preserveScroll: true }),
});

// --- Lightbox ---------------------------------------------------------------
// Prev/next follow the table's current sort order so stepping matches what
// the user sees; DataTable's @sort hands us the sorted rows.
const sortedRows = ref(null);
const rows = computed(() => sortedRows.value ?? props.videos);
const onSort = (e) => {
    if (!e.sortField) { sortedRows.value = null; return; }
    const dir = e.sortOrder;
    sortedRows.value = [...props.videos].sort((a, b) => {
        const av = a[e.sortField], bv = b[e.sortField];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
    });
};

const lightbox = ref(null);
const openLightbox = (item) => { lightbox.value = item; };
const lightboxIndex = computed(() => lightbox.value ? rows.value.findIndex((m) => m.id === lightbox.value.id) : -1);
const hasPrev = computed(() => lightboxIndex.value > 0);
const hasNext = computed(() => lightboxIndex.value > -1 && lightboxIndex.value < rows.value.length - 1);
const stepLightbox = (delta) => {
    const next = rows.value[lightboxIndex.value + delta];
    if (next) openLightbox(next);
};
const onLightboxKey = (e) => {
    if (!lightbox.value || e.target.closest?.('input, textarea')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); stepLightbox(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); stepLightbox(1); }
};
onMounted(() => window.addEventListener('keydown', onLightboxKey));
onUnmounted(() => window.removeEventListener('keydown', onLightboxKey));
</script>

<template>
    <Head title="Videos" />
    <Toast />
    <ConfirmDialog />
    <AuthenticatedLayout>
        <template #header>
            <div class="header-row">
                <h2 class="page-title">Videos</h2>
            </div>
        </template>

        <div class="stack">
            <Message v-if="!videos.length" severity="info" :closable="false">
                No videos yet. Upload them from an event page.
            </Message>

            <Card v-else>
                <template #content>
                    <DataTable :value="videos" data-key="id" stripedRows removableSort @sort="onSort">
                        <Column header="" style="width: 5rem">
                            <template #body="{ data }">
                                <button class="thumb-btn" :aria-label="`Play ${data.name}`" @click="openLightbox(data)">
                                    <img v-if="data.thumb_url" :src="data.thumb_url" :alt="data.name" loading="lazy" />
                                    <i v-else class="pi pi-video" />
                                </button>
                            </template>
                        </Column>
                        <Column field="name" header="Name" sortable>
                            <template #body="{ data }">
                                <button class="name-link" @click="openLightbox(data)">{{ data.name }}</button>
                                <div v-if="data.contributor_name" class="by">by {{ data.contributor_name }}</div>
                            </template>
                        </Column>
                        <Column header="Status">
                            <template #body="{ data }">
                                <Tag v-if="data.ready" severity="success" value="Ready" />
                                <Tag v-else severity="warn" value="Processing" />
                            </template>
                        </Column>
                        <Column field="duration" header="Duration" sortable>
                            <template #body="{ data }">{{ formatDuration(data.duration) }}</template>
                        </Column>
                        <Column field="size" header="Size" sortable>
                            <template #body="{ data }">{{ formatBytes(data.size) }}</template>
                        </Column>
                        <Column header="Event">
                            <template #body="{ data }">
                                <Link v-if="data.event" :href="route('events.show', data.event.id)" class="event-link">{{ data.event.name }}</Link>
                                <span v-else class="muted">—</span>
                            </template>
                        </Column>
                        <Column field="created_at" header="Uploaded" sortable>
                            <template #body="{ data }">{{ formatDate(data.created_at) }}</template>
                        </Column>
                        <Column header="" style="width: 11rem; text-align: right">
                            <template #body="{ data }">
                                <AddToCollectionMenu type="media" :ids="[data.id]" text rounded severity="secondary" />
                                <a :href="data.download_url" :download="data.name" class="dl-link" aria-label="Download">
                                    <Button icon="pi pi-download" severity="secondary" text rounded tabindex="-1" />
                                </a>
                                <Button icon="pi pi-trash" severity="danger" text rounded aria-label="Delete" @click="confirmDelete(data)" />
                            </template>
                        </Column>
                    </DataTable>
                </template>
            </Card>
        </div>

        <Dialog :visible="!!lightbox" modal dismissableMask :showHeader="false" :style="{ width: 'auto', maxWidth: '92vw' }" class="lightbox-dialog lightbox-video-dialog" @update:visible="lightbox = null">
            <template v-if="lightbox">
                <div class="lightbox-toolbar">
                    <AddToCollectionMenu type="media" :ids="[lightbox.id]" text rounded severity="secondary" />
                </div>
                <Button v-if="hasPrev" class="lightbox-nav lightbox-prev" icon="pi pi-chevron-left" text rounded severity="secondary" aria-label="Previous" @click="stepLightbox(-1)" />
                <Button v-if="hasNext" class="lightbox-nav lightbox-next" icon="pi pi-chevron-right" text rounded severity="secondary" aria-label="Next" @click="stepLightbox(1)" />
                <video :key="lightbox.id" :src="lightbox.url" controls autoplay class="lightbox-video" />
            </template>
        </Dialog>
    </AuthenticatedLayout>
</template>

<style scoped>
.header-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.page-title { font-size: 1.25rem; font-weight: 600; margin: 0; }
.stack { display: flex; flex-direction: column; gap: 1.5rem; }
.thumb-btn { display: flex; align-items: center; justify-content: center; width: 4rem; height: 2.5rem; padding: 0; border: 0; border-radius: 6px; overflow: hidden; cursor: pointer; background: var(--p-surface-100); color: var(--p-text-muted-color); }
.thumb-btn img { width: 100%; height: 100%; object-fit: cover; display: block; }
.name-link { background: none; border: 0; padding: 0; font: inherit; color: var(--p-primary-color); font-weight: 500; cursor: pointer; text-align: left; }
.name-link:hover { text-decoration: underline; }
.by { font-size: 0.75rem; color: var(--p-text-muted-color); }
.event-link { color: inherit; text-decoration: none; }
.event-link:hover { text-decoration: underline; }
.muted { color: var(--p-text-muted-color); }
.dl-link { display: inline-flex; line-height: 0; }
.lightbox-video { max-width: 90vw; max-height: 85vh; display: block; }
.lightbox-toolbar { position: absolute; top: 0.75rem; right: 0.75rem; z-index: 10; display: flex; gap: 0.25rem; background: rgba(0, 0, 0, 0.45); border-radius: 999px; padding: 0.15rem; }
.lightbox-toolbar :deep(.p-button) { color: #fff; }
.lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%); z-index: 10; color: #fff !important; background: rgba(0, 0, 0, 0.45) !important; }
.lightbox-prev { left: 0.75rem; }
.lightbox-next { right: 0.75rem; }
:global(.lightbox-dialog .p-dialog-content) { position: relative; }
@media (max-width: 640px) {
    :global(.lightbox-video-dialog) { width: 100vw !important; max-width: 100vw !important; height: 100dvh !important; margin: 0 !important; border-radius: 0 !important; }
    :global(.lightbox-video-dialog .p-dialog-content) { padding: 0 !important; height: 100%; background: #000; display: flex; align-items: center; }
    .lightbox-video { max-width: 100vw; max-height: 100dvh; width: 100%; height: 100%; object-fit: contain; }
}
</style>
