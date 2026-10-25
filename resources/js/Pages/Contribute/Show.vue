<script setup>
import { ref, computed } from 'vue';
import { Head, router } from '@inertiajs/vue3';
import PublicLayout from '@/Layouts/PublicLayout.vue';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Message from 'primevue/message';
import InputText from 'primevue/inputtext';
import ProgressBar from 'primevue/progressbar';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { useS3Upload } from '@/composables/useS3Upload';

const props = defineProps({
    invite: { type: Object, required: true },
    event: { type: Object, required: true },
});

const toast = useToast();

// Free-text attribution; sent with every file the contributor adds this session.
const name = ref('');
// Count of successful uploads, to swap copy to a friendly "thanks" once they start.
const doneCount = ref(0);

const formatDate = (iso) => iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

const ALLOWED = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
];

const { uploads, addFiles } = useS3Upload({
    routes: {
        uploadUrl: route('contribute.upload-url', props.invite.token),
        multipartCreate: route('contribute.multipart.create', props.invite.token),
        multipartSign: route('contribute.multipart.sign', props.invite.token),
        multipartComplete: route('contribute.multipart.complete', props.invite.token),
        multipartAbort: route('contribute.multipart.abort', props.invite.token),
        cleanup: route('contribute.cleanup', props.invite.token),
    },
    initBody: (file) => ({ filename: file.name, size: file.size, content_type: file.type }),
    validate: (file) => ALLOWED.includes(file.type)
        ? null
        : `${file.type || file.name.split('.').pop()?.toUpperCase() || 'this'} isn't a supported type (JPEG, PNG, WebP, GIF, MP4, MOV, WebM, MKV)`,
    finalize: (file, key) => new Promise((resolve, reject) => {
        router.post(route('contribute.store', props.invite.token), {
            s3_key: key,
            original_name: file.name,
            mime: file.type,
            size: file.size,
            contributor_name: name.value.trim() || null,
        }, { preserveScroll: true, preserveState: true, onSuccess: resolve, onError: reject });
    }),
    onUploaded: (file) => {
        doneCount.value++;
        toast.add({ severity: 'success', summary: 'Uploaded', detail: file.name, life: 3000 });
    },
    onError: (file, message) => {
        rejected.value.push({ name: file?.name, message });
        toast.add({ severity: 'error', summary: 'Upload failed', detail: `${file?.name}: ${message}`, life: 5000 });
    },
});

// Files the browser handed us that we couldn't take, shown inline: toasts are
// easy to miss on a phone, and "nothing happened" is the worst outcome here.
const rejected = ref([]);

const onSelected = (event) => {
    const files = Array.from(event.target.files || []);
    addFiles(files);
    // Clear after queueing so picking the same file twice still fires `change`.
    event.target.value = '';
};
</script>

<template>
    <Head :title="`Add to ${event.name}`" />
    <Toast />

    <PublicLayout>
        <div class="contribute">
            <header class="intro">
                <Tag v-if="invite.label" :value="invite.label" severity="secondary" />
                <h1>{{ event.name }}</h1>
                <p v-if="event.event_date || event.location" class="meta">
                    <span v-if="event.event_date">{{ formatDate(event.event_date) }}</span>
                    <span v-if="event.location"><i class="pi pi-map-marker" /> {{ event.location }}</span>
                </p>
            </header>

            <Message v-if="!invite.active" severity="warn" :closable="false">
                This upload link is no longer active. Ask the organiser for a fresh one.
            </Message>

            <template v-else>
                <Card class="panel">
                    <template #content>
                        <h2>Add your photos &amp; videos</h2>
                        <p class="hint">They go straight to the organiser of this event. You don't need an account.</p>

                        <div class="field">
                            <label for="c-name">Your name <span class="optional">(optional)</span></label>
                            <InputText id="c-name" v-model="name" placeholder="So they know who to thank" />
                        </div>

                        <!--
                            The real <input type=file> sits invisibly over the button so the
                            tap lands on it directly. A programmatic .click() on a hidden
                            input is ignored by some mobile browsers and in-app webviews
                            (Messenger, Instagram), which looked like the button doing nothing.
                        -->
                        <div class="picker">
                            <Button class="pick" icon="pi pi-camera" label="Choose photos or videos" size="large" tabindex="-1" aria-hidden="true" />
                            <input class="picker-input" type="file" accept="image/*,video/*" multiple aria-label="Choose photos or videos" @change="onSelected" />
                        </div>
                    </template>
                </Card>

                <Message v-if="rejected.length" severity="error" :closable="true" @close="rejected = []">
                    <ul class="rejected">
                        <li v-for="(r, i) in rejected" :key="i"><strong>{{ r.name }}</strong>: {{ r.message }}</li>
                    </ul>
                </Message>

                <Card v-if="uploads.length" class="panel">
                    <template #content>
                        <div v-for="u in uploads" :key="u.name" class="upload-row">
                            <div class="upload-name"><i class="pi pi-cloud-upload" /> <span>{{ u.name }}</span> <Tag :value="u.status" /></div>
                            <ProgressBar :value="u.progress" />
                        </div>
                    </template>
                </Card>

                <Message v-if="doneCount && !uploads.length" severity="success" :closable="false">
                    Thanks! {{ doneCount }} {{ doneCount === 1 ? 'file' : 'files' }} uploaded. Add more any time.
                </Message>
            </template>
        </div>
    </PublicLayout>
</template>

<style scoped>
.contribute { max-width: 36rem; margin: 0 auto; display: flex; flex-direction: column; gap: 1.25rem; }
.intro { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
.intro h1 { font-size: 1.6rem; font-weight: 700; margin: 0; }
.meta { display: flex; gap: 1rem; font-size: 0.9rem; color: var(--p-text-muted-color); margin: 0; }
.meta i { margin-right: 0.25rem; }
.panel h2 { font-size: 1.1rem; font-weight: 600; margin: 0 0 0.25rem; }
.hint { color: var(--p-text-muted-color); font-size: 0.9rem; margin: 0 0 1.25rem; }
.field { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.25rem; }
.field label { font-size: 0.85rem; font-weight: 500; }
.field :deep(.p-inputtext) { width: 100%; }
.optional { font-weight: 400; color: var(--p-text-muted-color); }
.picker { position: relative; }
.pick { width: 100%; }
.picker-input {
    position: absolute; inset: 0; width: 100%; height: 100%;
    opacity: 0; cursor: pointer; font-size: 0; /* no stray "No file chosen" text */
}
.picker:focus-within .pick { outline: 2px solid var(--p-primary-color); outline-offset: 2px; }
.rejected { margin: 0; padding-left: 1.1rem; font-size: 0.875rem; }
.upload-row { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.75rem; }
.upload-row:last-child { margin-bottom: 0; }
.upload-name { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
</style>
