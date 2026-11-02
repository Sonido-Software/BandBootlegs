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
import ProgressBar from 'primevue/progressbar';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import AddToCollectionMenu from '@/Components/AddToCollectionMenu.vue';
import LibraryTabs from '@/Components/LibraryTabs.vue';
import { useS3Upload } from '@/composables/useS3Upload';
import { useNewActions } from '@/lib/newActions';

// The Library's Videos (sortable table) and Photos (grid) tabs: every item the
// user owns, across events. Uploads from here land unfiled.
const props = defineProps({
    kind: { type: String, required: true }, // 'video' | 'image'
    items: { type: Array, required: true },
    unfiled: { type: Boolean, default: false },
    // Videos only: the server pages and sorts the table.
    sort: { type: String, default: null },
    dir: { type: String, default: 'desc' },
    pagination: { type: Object, default: null }, // { page, perPage, total }
});

const isVideo = computed(() => props.kind === 'video');
const noun = computed(() => isVideo.value ? 'video' : 'photo');

const confirm = useConfirm();
const toast = useToast();

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
    header: `Delete ${noun.value}`,
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: () => router.delete(route('media.destroy', item.id), { preserveScroll: true }),
});

// --- Uploads (unfiled) -------------------------------------------------------
const ALLOWED = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
];

const { uploads, addFiles } = useS3Upload({
    routes: {
        uploadUrl: route('media.upload-url'),
        multipartCreate: route('media.multipart.create'),
        multipartSign: route('media.multipart.sign'),
        multipartComplete: route('media.multipart.complete'),
        multipartAbort: route('media.multipart.abort'),
        cleanup: route('media.cleanup'),
        store: route('media.store'),
    },
    initBody: (file) => ({ filename: file.name, size: file.size, content_type: file.type }),
    validate: (file) => ALLOWED.includes(file.type) ? null : 'unsupported file type',
    finalize: (file, key) => new Promise((resolve, reject) => {
        router.post(route('media.store'), {
            s3_key: key,
            original_name: file.name,
            mime: file.type,
            size: file.size,
        }, { preserveScroll: true, preserveState: true, onSuccess: resolve, onError: reject });
    }),
    onUploaded: (file) => toast.add({ severity: 'success', summary: 'Uploaded', detail: file.name, life: 3000 }),
    onError: (file, message) => toast.add({ severity: 'error', summary: 'Upload failed', detail: `${file?.name}: ${message}`, life: 5000 }),
});

const onSelected = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    addFiles(files);
};

useNewActions({ media: addFiles });

// --- Paging and sorting (videos) ---------------------------------------------
// The table runs in lazy mode: each page or sort change asks the server for
// that page, so sorting covers every video rather than the rows on screen.
const visit = (params) => router.get(route('media.index'), {
    ...(props.unfiled ? { unfiled: 1 } : {}),
    ...params,
}, { preserveState: true, preserveScroll: true, only: ['items', 'pagination', 'sort', 'dir'] });

const sortParams = () => props.sort ? { sort: props.sort, dir: props.dir } : {};

const onPage = (e) => visit({ ...sortParams(), page: e.page + 1 });

// A new sort starts again from page one; removableSort's third click clears it.
const onSort = (e) => visit(e.sortField ? { sort: e.sortField, dir: e.sortOrder === 1 ? 'asc' : 'desc' } : {});

// --- Lightbox ---------------------------------------------------------------
// Prev/next step through the rows on screen, in the order the server sent them.
const rows = computed(() => props.items);

const lightbox = ref(null);
const openLightbox = (item) => { lightbox.value = item; };
const lightboxIndex = computed(() => lightbox.value ? rows.value.findIndex((m) => m.id === lightbox.value.id) : -1);
const hasPrev = computed(() => lightboxIndex.value > 0);
const hasNext = computed(() => lightboxIndex.value > -1 && lightboxIndex.value < rows.value.length - 1);
const stepLightbox = (delta) => {
    const next = rows.value[lightboxIndex.value + delta];
    if (next) openLightbox(next);
};
const deleteFromLightbox = () => {
    const item = lightbox.value;
    lightbox.value = null;
    confirmDelete(item);
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
    <Head :title="isVideo ? 'Library · Videos' : 'Library · Photos'" />
    <Toast />
    <ConfirmDialog />
    <AuthenticatedLayout>
        <template #header>
            <div class="header-row">
                <h2 class="page-title">Library</h2>
                <!-- The real input sits over the button so a phone tap opens the picker directly. -->
                <div class="picker">
                    <Button icon="pi pi-upload" label="Upload photos & videos" tabindex="-1" aria-hidden="true" />
                    <input class="picker-input" type="file" accept="image/*,video/*" multiple aria-label="Upload photos and videos" @change="onSelected" />
                </div>
            </div>
            <LibraryTabs :current="isVideo ? 'videos' : 'photos'" :unfiled="unfiled" class="library-tabs" />
        </template>

        <div class="stack">
            <Card v-if="uploads.length">
                <template #content>
                    <div v-for="u in uploads" :key="u.name" class="upload-row">
                        <div class="upload-name"><i class="pi pi-cloud-upload" /> <span>{{ u.name }}</span> <Tag :value="u.status" /></div>
                        <ProgressBar :value="u.progress" />
                    </div>
                </template>
            </Card>

            <Message v-if="!items.length" severity="info" :closable="false">
                <template v-if="unfiled">Every {{ noun }} is in an event.</template>
                <template v-else>No {{ noun }}s yet. Upload them here or from an event page.</template>
            </Message>

            <Card v-else-if="isVideo">
                <template #content>
                    <DataTable
                        :value="items"
                        data-key="id"
                        stripedRows
                        removableSort
                        lazy
                        :paginator="pagination.total > pagination.perPage"
                        :rows="pagination.perPage"
                        :totalRecords="pagination.total"
                        :first="(pagination.page - 1) * pagination.perPage"
                        :sortField="sort"
                        :sortOrder="sort ? (dir === 'asc' ? 1 : -1) : null"
                        paginatorTemplate="PrevPageLink PageLinks NextPageLink CurrentPageReport"
                        currentPageReportTemplate="{first}–{last} of {totalRecords}"
                        @page="onPage"
                        @sort="onSort"
                    >
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
                                <!-- Phones fold the hidden columns into the row itself. -->
                                <div class="row-meta sm-only">
                                    <span>{{ formatDuration(data.duration) }}</span>
                                    <span v-if="data.event">· {{ data.event.name }}</span>
                                    <Tag v-if="!data.ready" severity="warn" value="Processing" />
                                </div>
                            </template>
                        </Column>
                        <Column header="Status" headerClass="lg-only" bodyClass="lg-only">
                            <template #body="{ data }">
                                <Tag v-if="data.ready" severity="success" value="Ready" />
                                <Tag v-else severity="warn" value="Processing" />
                            </template>
                        </Column>
                        <Column field="duration" header="Duration" sortable headerClass="lg-only" bodyClass="lg-only">
                            <template #body="{ data }">{{ formatDuration(data.duration) }}</template>
                        </Column>
                        <Column field="size" header="Size" sortable headerClass="lg-only" bodyClass="lg-only">
                            <template #body="{ data }">{{ formatBytes(data.size) }}</template>
                        </Column>
                        <Column header="Event" headerClass="lg-only" bodyClass="lg-only">
                            <template #body="{ data }">
                                <Link v-if="data.event" :href="route('events.show', data.event.id)" class="event-link">{{ data.event.name }}</Link>
                                <span v-else class="muted">—</span>
                            </template>
                        </Column>
                        <Column field="created_at" header="Uploaded" sortable headerClass="lg-only" bodyClass="lg-only">
                            <template #body="{ data }">{{ formatDate(data.created_at) }}</template>
                        </Column>
                        <Column header="" style="width: 11rem; text-align: right" bodyClass="actions-cell">
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

            <div v-else class="photo-grid">
                <div v-for="item in items" :key="item.id" class="photo-tile">
                    <button class="photo-btn" :aria-label="`Open ${item.name}`" @click="openLightbox(item)">
                        <img :src="item.thumb_url || item.url" :alt="item.name" loading="lazy" />
                    </button>
                    <div class="tile-actions">
                        <a :href="item.download_url" :download="item.name" class="dl-link" aria-label="Download">
                            <Button icon="pi pi-download" severity="secondary" text rounded size="small" tabindex="-1" />
                        </a>
                        <AddToCollectionMenu type="media" :ids="[item.id]" text rounded size="small" />
                        <Button icon="pi pi-trash" severity="danger" text rounded size="small" aria-label="Delete" @click="confirmDelete(item)" />
                    </div>
                    <Link v-if="item.event" :href="route('events.show', item.event.id)" class="tile-event" :title="item.event.name">{{ item.event.name }}</Link>
                </div>
            </div>
        </div>

        <Dialog :visible="!!lightbox" modal dismissableMask :showHeader="false" :style="{ width: 'auto', maxWidth: '92vw' }" :class="['lightbox-dialog', isVideo ? 'lightbox-video-dialog' : '']" @update:visible="lightbox = null">
            <template v-if="lightbox">
                <div class="lightbox-toolbar">
                    <AddToCollectionMenu type="media" :ids="[lightbox.id]" text rounded severity="secondary" />
                    <a :href="lightbox.download_url" :download="lightbox.name" class="dl-link" aria-label="Download">
                        <Button icon="pi pi-download" text rounded severity="secondary" tabindex="-1" />
                    </a>
                    <Button icon="pi pi-trash" text rounded severity="secondary" aria-label="Delete" @click="deleteFromLightbox" />
                </div>
                <Button v-if="hasPrev" class="lightbox-nav lightbox-prev" icon="pi pi-chevron-left" text rounded severity="secondary" aria-label="Previous" @click="stepLightbox(-1)" />
                <Button v-if="hasNext" class="lightbox-nav lightbox-next" icon="pi pi-chevron-right" text rounded severity="secondary" aria-label="Next" @click="stepLightbox(1)" />
                <video v-if="isVideo" :key="lightbox.id" :src="lightbox.url" controls autoplay class="lightbox-video" />
                <img v-else :src="lightbox.url" :alt="lightbox.name" class="lightbox-img" />
            </template>
        </Dialog>
    </AuthenticatedLayout>
</template>

<style scoped>
.header-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.page-title { font-size: 1.25rem; font-weight: 600; margin: 0; }
.library-tabs { margin-top: 1rem; }
.picker { position: relative; display: inline-flex; }
.picker-input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; font-size: 0; }
.picker:focus-within :deep(.p-button) { outline: 2px solid var(--p-primary-color); outline-offset: 2px; }
.stack { display: flex; flex-direction: column; gap: 1.5rem; }
.upload-row { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.75rem; }
.upload-name { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
.thumb-btn { display: flex; align-items: center; justify-content: center; width: 4rem; height: 2.5rem; padding: 0; border: 0; border-radius: 6px; overflow: hidden; cursor: pointer; background: var(--p-surface-100); color: var(--p-text-muted-color); }
.thumb-btn img { width: 100%; height: 100%; object-fit: cover; display: block; }
.name-link { background: none; border: 0; padding: 0; font: inherit; color: var(--p-primary-color); font-weight: 500; cursor: pointer; text-align: left; }
.name-link:hover { text-decoration: underline; }
.by { font-size: 0.75rem; color: var(--p-text-muted-color); }
.event-link { color: inherit; text-decoration: none; }
.event-link:hover { text-decoration: underline; }
.muted { color: var(--p-text-muted-color); }
.dl-link { display: inline-flex; line-height: 0; }
.sm-only { display: none; }
.row-meta { align-items: center; gap: 0.4rem; margin-top: 0.2rem; font-size: 0.8rem; color: var(--p-text-muted-color); font-variant-numeric: tabular-nums; }
.photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: 0.75rem; }
.photo-tile { position: relative; }
.photo-btn { display: block; width: 100%; aspect-ratio: 1; padding: 0; border: 0; border-radius: 8px; overflow: hidden; cursor: pointer; background: var(--p-surface-100); }
.photo-btn img { width: 100%; height: 100%; object-fit: cover; display: block; }
.tile-actions { position: absolute; top: 0.25rem; right: 0.25rem; display: flex; gap: 0.15rem; background: rgba(0,0,0,0.45); border-radius: 6px; opacity: 0; transition: opacity 0.12s; }
.tile-actions :deep(.p-button) { color: #fff; }
.photo-tile:hover .tile-actions, .photo-tile:focus-within .tile-actions { opacity: 1; }
.tile-event { position: absolute; left: 0.35rem; bottom: 0.35rem; max-width: calc(100% - 0.7rem); font-size: 0.7rem; color: #fff; background: rgba(0,0,0,0.45); border-radius: 5px; padding: 0.1rem 0.35rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lightbox-img { max-width: 90vw; max-height: 85vh; display: block; }
.lightbox-video { max-width: 90vw; max-height: 85vh; display: block; }
.lightbox-toolbar { position: absolute; top: 0.75rem; right: 0.75rem; z-index: 10; display: flex; gap: 0.25rem; background: rgba(0, 0, 0, 0.45); border-radius: 999px; padding: 0.15rem; }
.lightbox-toolbar :deep(.p-button) { color: #fff; }
.lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%); z-index: 10; color: #fff !important; background: rgba(0, 0, 0, 0.45) !important; }
.lightbox-prev { left: 0.75rem; }
.lightbox-next { right: 0.75rem; }
:global(.lightbox-dialog .p-dialog-content) { position: relative; }
@media (max-width: 640px) {
    :deep(.lg-only) { display: none; }
    .row-meta.sm-only { display: flex; }
    :deep(.actions-cell) { width: auto !important; white-space: nowrap; }
    .photo-grid { grid-template-columns: repeat(3, 1fr); gap: 0.35rem; }
    /* No hover on touch: download, collect and delete live in the lightbox toolbar. */
    .tile-actions, .tile-event { display: none; }
    :global(.lightbox-video-dialog) { width: 100vw !important; max-width: 100vw !important; height: 100dvh !important; margin: 0 !important; border-radius: 0 !important; }
    :global(.lightbox-video-dialog .p-dialog-content) { padding: 0 !important; height: 100%; background: #000; display: flex; align-items: center; }
    .lightbox-video { max-width: 100vw; max-height: 100dvh; width: 100%; height: 100%; object-fit: contain; }
}
</style>
