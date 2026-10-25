import { ref, watch, onScopeDispose, getCurrentScope } from 'vue';
import Uppy from '@uppy/core';
import AwsS3 from '@uppy/aws-s3';

const csrfToken = () => decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] || '');

export const apiFetch = (url, { method = 'GET', body } = {}) => fetch(url, {
    method,
    credentials: 'same-origin',
    headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-XSRF-TOKEN': csrfToken(),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
});

/**
 * Phones and tablets have a fraction of a laptop's memory and uplink. Every
 * in-flight part is a Blob slice the browser buffers in the page process, so the
 * desktop tuning (10 × 25 MB) pinned ~250 MB on a phone — mobile Safari/Chrome
 * stalled with "page not responding" and the first progress tick took ages.
 * Smaller parts, fewer in flight, and a lower multipart threshold keep memory
 * flat and get bytes (and a progress bar) moving within seconds.
 */
const isMobile = typeof navigator !== 'undefined' && (
    navigator.userAgentData?.mobile
    || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    // iPadOS Safari reports a desktop Mac UA; touch points give it away.
    || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
);

const MB = 1024 * 1024;
const profile = isMobile
    ? { multipartThreshold: 20 * MB, partSize: 8 * MB, limit: 3 }
    : { multipartThreshold: 100 * MB, partSize: 25 * MB, limit: 10 };

/**
 * Some mobile pickers (notably Android for .mov/.mkv, and anything shared via a
 * content: URI) hand over a File with an empty `type`, which would fail the
 * MIME allow-list even though the bytes are fine. Fill it in from the extension.
 * `new File([blob])` references the original bytes — it doesn't copy them.
 */
const TYPE_BY_EXT = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska',
};
const withResolvedType = (file) => {
    if (file.type) return file;
    const type = TYPE_BY_EXT[file.name.split('.').pop()?.toLowerCase()];
    if (!type) return file;
    return new File([file], file.name, { type, lastModified: file.lastModified });
};

/**
 * Direct-to-R2 uploads via Uppy + the unified AWS S3 plugin: small files take a
 * single presigned PUT, anything large is uploaded as multipart so multi-gig
 * files don't ride on one request. All signing/finalising goes through the app
 * endpoints named in `routes`; the browser PUTs the bytes straight to R2.
 *
 * The same machinery backs both track and media uploads — only the endpoint
 * names, the per-file init body, and what "finalise" means (creating the DB
 * row) differ, so those are injected by the caller.
 *
 * @param {{
 *   routes: { uploadUrl: string, multipartCreate: string, multipartSign: string, multipartComplete: string, multipartAbort: string, cleanup: string },
 *   initBody: (file) => object,
 *   finalize: (file, key) => Promise<void>,
 *   validate?: (file) => (string|null),
 *   onUploaded?: (file) => void,
 *   onError?: (file, message) => void,
 * }} options
 */
export function useS3Upload({ routes, initBody, finalize, validate, onUploaded, onError }) {
    // The reactive rows rendered as an upload progress list.
    const uploads = ref([]);
    // uppy file id -> reactive row.
    const entries = new Map();
    // uppy file id -> storage key minted when the upload was initiated.
    const keys = new Map();

    const uppy = new Uppy({ autoProceed: true })
        .use(AwsS3, {
            // Below the threshold a single PUT is simpler and cheaper than
            // multipart (100 MB on desktop; 20 MB on mobile so a flaky uplink
            // retries a part, not the whole file).
            shouldUseMultipart: (file) => file.size > profile.multipartThreshold,
            // Large parts (25 MB desktop) keep a 4 GB file at ~160 parts instead
            // of ~820; scale up for very large files so we stay under S3's
            // 10,000 cap. Mobile uses 8 MB parts to bound memory.
            getChunkSize: (file) => Math.max(profile.partSize, Math.ceil(file.size / 9000)),
            // Concurrent parts in flight. 10 saturates a fast desktop uplink;
            // mobile browsers cap connections per host around 6 anyway and
            // every extra part is more buffered memory, so 3 there.
            limit: profile.limit,

            async getUploadParameters(file) {
                const res = await apiFetch(routes.uploadUrl, { method: 'POST', body: initBody(file) });
                if (!res.ok) throw new Error(`init failed (${res.status})`);
                const data = await res.json();
                keys.set(file.id, data.s3_key);
                return { method: 'PUT', url: data.url, headers: data.headers || {} };
            },

            async createMultipartUpload(file) {
                const res = await apiFetch(routes.multipartCreate, { method: 'POST', body: initBody(file) });
                if (!res.ok) throw new Error(`init failed (${res.status})`);
                const data = await res.json();
                keys.set(file.id, data.key);
                return { uploadId: data.uploadId, key: data.key };
            },

            async signPart(file, { uploadId, key, partNumber }) {
                const url = `${routes.multipartSign}?key=${encodeURIComponent(key)}`
                    + `&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`;
                const res = await apiFetch(url);
                if (!res.ok) throw new Error(`sign failed (${res.status})`);
                return { url: (await res.json()).url };
            },

            async completeMultipartUpload(file, { uploadId, key, parts }) {
                const res = await apiFetch(routes.multipartComplete, { method: 'POST', body: { key, uploadId, parts } });
                if (!res.ok) throw new Error(`complete failed (${res.status})`);
                return { location: (await res.json()).location };
            },

            async abortMultipartUpload(file, { uploadId, key }) {
                await apiFetch(routes.multipartAbort, { method: 'POST', body: { key, uploadId } });
            },
        });

    uppy.on('upload-progress', (file, progress) => {
        const entry = entries.get(file.id);
        if (!entry) return;
        entry.status = 'uploading';
        if (progress.bytesTotal) entry.progress = Math.round((progress.bytesUploaded / progress.bytesTotal) * 100);
    });

    // The bytes are in storage; create the DB row so the rest of the app sees it.
    uppy.on('upload-success', async (file) => {
        const entry = entries.get(file.id);
        const key = keys.get(file.id);
        if (entry) { entry.status = 'finalizing'; entry.progress = 100; }

        try {
            await finalize(file, key);
            if (entry) {
                entry.status = 'done';
                uploads.value = uploads.value.filter(u => u !== entry);
            }
            onUploaded?.(file);
        } catch (err) {
            if (entry) entry.status = 'error';
            // The bytes reached the bucket but no DB row was created; delete the
            // orphaned object so a failed finalise doesn't leak storage. Best
            // effort — nothing the user can do if cleanup itself fails.
            if (key && routes.cleanup) {
                apiFetch(routes.cleanup, { method: 'POST', body: { key } }).catch(() => {});
            }
            onError?.(file, 'finalize failed');
        } finally {
            entries.delete(file.id);
            keys.delete(file.id);
            uppy.removeFile(file.id);
        }
    });

    uppy.on('upload-error', (file, error) => {
        const entry = entries.get(file?.id);
        if (entry) entry.status = 'error';
        onError?.(file, error?.message || 'error');
        entries.delete(file?.id);
        keys.delete(file?.id);
    });

    // --- Keep the phone awake while uploading --------------------------------
    // Mobile browsers freeze JS when the screen locks, which kills an upload
    // halfway through a multi-gig video. A screen wake lock (Chrome Android,
    // Safari 16.4+) is best effort: denied or unsupported just means the user
    // has to keep the screen on themselves. The OS releases it whenever the
    // tab is hidden, so re-request when the tab comes back if still uploading.
    const active = () => uploads.value.some(u => u.status !== 'error' && u.status !== 'done');
    let wakeLock = null;
    const holdWakeLock = async () => {
        if (wakeLock || !navigator.wakeLock || document.visibilityState !== 'visible') return;
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        } catch { /* low battery / permission — nothing to do */ }
    };
    const releaseWakeLock = () => { wakeLock?.release().catch(() => {}); wakeLock = null; };
    const onVisibility = () => { if (active()) holdWakeLock(); };
    // Navigating away mid-upload silently loses the file; let the browser ask.
    const onBeforeUnload = (e) => { if (active()) { e.preventDefault(); e.returnValue = ''; } };

    watch(() => active(), (busy) => (busy ? holdWakeLock() : releaseWakeLock()));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);
    if (getCurrentScope()) {
        onScopeDispose(() => {
            releaseWakeLock();
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('beforeunload', onBeforeUnload);
        });
    }

    const addFiles = (files) => {
        for (let file of files) {
            file = withResolvedType(file);
            const problem = validate?.(file);
            if (problem) { onError?.(file, problem); continue; }

            const entry = ref({ name: file.name, progress: 0, status: 'queued' });
            uploads.value.push(entry.value);

            try {
                const id = uppy.addFile({ name: file.name, type: file.type, data: file });
                entries.set(id, entry.value);
            } catch (err) {
                entry.value.status = 'error';
                onError?.(file, err?.message || 'could not queue');
            }
        }
    };

    return { uploads, addFiles };
}
