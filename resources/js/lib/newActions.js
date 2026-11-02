import { reactive, onMounted, onBeforeUnmount } from 'vue';
import { router } from '@inertiajs/vue3';

// The global "+ New" menu lives in the layout, but the upload machinery lives
// in pages. A page registers what it can handle here; picks the current page
// can't handle are stashed and handed to a page that can after a visit. Files
// survive the visit because Inertia navigation never reloads the document.
//
// Kinds: 'tracks' and 'stitch' (File[] of .wav), 'media' (File[] of photos and
// videos), 'event' and 'collection' (no files: open the create dialog).

const handlers = reactive({});

// Shown in the menu so the user knows where an upload will land.
export const newContext = reactive({ target: null });

let pending = null;

const fallbackRoute = (kind, files) => {
    switch (kind) {
        case 'tracks':
        case 'stitch':
            return route('tracks.index');
        case 'media':
            return files?.length && files.every((f) => f.type.startsWith('video/'))
                ? route('media.index')
                : route('media.photos');
        case 'event':
            return route('events.index');
        case 'collection':
            return route('collections.index');
    }
};

export function runNewAction(kind, files = null) {
    if (handlers[kind]) {
        handlers[kind](files);
        return;
    }
    pending = { kind, files };
    router.visit(fallbackRoute(kind, files));
}

/**
 * Register this page's "+ New" handlers for as long as it's mounted, and run
 * any pick that was stashed for it on the way here. `target` names where new
 * uploads land ("Fall Show", "your library").
 */
export function useNewActions(map, { target = null } = {}) {
    onMounted(() => {
        Object.assign(handlers, map);
        newContext.target = target;

        if (pending && map[pending.kind]) {
            const { kind, files } = pending;
            pending = null;
            map[kind](files);
        }
    });

    onBeforeUnmount(() => {
        for (const [kind, fn] of Object.entries(map)) {
            if (handlers[kind] === fn) delete handlers[kind];
        }
        if (newContext.target === target) newContext.target = null;
    });
}
