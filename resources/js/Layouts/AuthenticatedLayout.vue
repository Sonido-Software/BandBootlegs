<script setup>
import { ref, computed } from 'vue';
import { Link, router, usePage } from '@inertiajs/vue3';
import Menu from 'primevue/menu';
import Button from 'primevue/button';
import Avatar from 'primevue/avatar';
import Popover from 'primevue/popover';
import Drawer from 'primevue/drawer';
import Breadcrumbs from '@/Components/Breadcrumbs.vue';
import NewMenu from '@/Components/NewMenu.vue';
import { runNewAction } from '@/lib/newActions';

const props = defineProps({
    // Parent pages, [{ label, href }]. Desktop shows them above the title; phones
    // turn the last one into the top bar's back link.
    breadcrumbs: { type: Array, default: () => [] },
    // Which primary section to highlight; derived from the route when omitted.
    section: { type: String, default: null },
    // Hides the phone tab bar on screens that need the full height (the mixer).
    immersive: { type: Boolean, default: false },
});

const page = usePage();

const sections = [
    { key: 'events', label: 'Events', icon: 'pi pi-calendar', route: 'events.index' },
    { key: 'library', label: 'Library', icon: 'pi pi-list', route: 'tracks.index' },
    { key: 'collections', label: 'Collections', icon: 'pi pi-folder', route: 'collections.index' },
];

const currentSection = computed(() => {
    if (props.section) return props.section;
    if (route().current('events.*')) return 'events';
    if (route().current('collections.*')) return 'collections';
    if (route().current('tracks.*') || route().current('media.*')) return 'library';
    if (route().current('profile.*')) return 'you';
    return null;
});

const backCrumb = computed(() => [...props.breadcrumbs].reverse().find((c) => c.href) ?? null);

// --- User menu ---------------------------------------------------------------
const userMenu = ref(null);
const userMenuItems = computed(() => [
    page.props.auth.publicPageUrl
        ? { label: 'Public page', icon: 'pi pi-globe', url: page.props.auth.publicPageUrl, target: '_blank' }
        : { label: 'Public page', icon: 'pi pi-globe', command: () => router.visit(route('profile.edit') + '#public-page') },
    { label: 'Profile', icon: 'pi pi-user', command: () => router.visit(route('profile.edit')) },
    { separator: true },
    { label: 'Log Out', icon: 'pi pi-sign-out', command: () => router.post(route('logout')) },
]);

const initials = (name) => name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';

// --- "+ New" -----------------------------------------------------------------
// The file inputs stay mounted here (not inside the popover/sheet) so closing
// the menu as the picker opens can't take the input and its change event with it.
const inputIds = { tracks: 'new-input-tracks', stitch: 'new-input-stitch', media: 'new-input-media' };
const newPopover = ref(null);
const newSheet = ref(false);

const closeNew = () => {
    newPopover.value?.hide();
    newSheet.value = false;
};

// Let the label's own activation reach the input before the menu goes away.
const onPicked = () => setTimeout(closeNew, 0);

const onFiles = (kind, event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length) runNewAction(kind, files);
};

const onCreate = (kind) => {
    closeNew();
    runNewAction(kind);
};
</script>

<template>
    <div class="app-shell" :class="{ immersive }">
        <header class="topbar">
            <div class="topbar-inner">
                <Link v-if="backCrumb" :href="backCrumb.href" class="back sm-only">
                    <i class="pi pi-arrow-left" aria-hidden="true" />
                    <span>{{ backCrumb.label }}</span>
                </Link>
                <Link :href="route('events.index')" class="brand" :class="{ 'lg-only': backCrumb }">
                    <img class="brand-logo" src="/images/logo.png" alt="Band Bootlegs" />
                </Link>

                <nav class="primary-nav lg-only" aria-label="Main">
                    <Link
                        v-for="s in sections"
                        :key="s.key"
                        :href="route(s.route)"
                        class="nav-link"
                        :class="{ on: currentSection === s.key }"
                        :aria-current="currentSection === s.key ? 'page' : undefined"
                    >{{ s.label }}</Link>
                </nav>

                <span class="spacer" />

                <Button class="lg-only" icon="pi pi-plus" label="New" aria-haspopup="true" @click="(e) => newPopover.toggle(e)" />
                <Button text class="user-button lg-only" @click="(e) => userMenu.toggle(e)" :aria-label="page.props.auth.user.name" aria-haspopup="true" aria-controls="user-menu">
                    <Avatar :label="initials(page.props.auth.user.name)" shape="circle" />
                    <span class="user-name">{{ page.props.auth.user.name }}</span>
                    <i class="pi pi-chevron-down" />
                </Button>
            </div>
        </header>

        <header v-if="$slots.header" class="page-header">
            <div class="container">
                <Breadcrumbs :items="breadcrumbs" class="lg-only page-crumbs" />
                <slot name="header" />
            </div>
        </header>

        <main class="page-main">
            <div class="container">
                <slot />
            </div>
        </main>

        <nav v-if="!immersive" class="tabbar sm-only" aria-label="Main">
            <Link :href="route('events.index')" class="tab" :class="{ on: currentSection === 'events' }">
                <i class="pi pi-calendar" /><span>Events</span>
            </Link>
            <Link :href="route('tracks.index')" class="tab" :class="{ on: currentSection === 'library' }">
                <i class="pi pi-list" /><span>Library</span>
            </Link>
            <button type="button" class="tab" aria-label="New" @click="newSheet = true">
                <span class="plus"><i class="pi pi-plus" /></span>
            </button>
            <Link :href="route('collections.index')" class="tab" :class="{ on: currentSection === 'collections' }">
                <i class="pi pi-folder" /><span>Collections</span>
            </Link>
            <button type="button" class="tab" :class="{ on: currentSection === 'you' }" aria-haspopup="true" aria-controls="user-menu" @click="(e) => userMenu.toggle(e)">
                <i class="pi pi-user" /><span>You</span>
            </button>
        </nav>

        <Menu id="user-menu" ref="userMenu" :model="userMenuItems" :popup="true" />
        <Popover ref="newPopover">
            <NewMenu :input-ids="inputIds" @picked="onPicked" @create="onCreate" />
        </Popover>
        <Drawer v-model:visible="newSheet" position="bottom" header="New" class="new-sheet">
            <NewMenu :input-ids="inputIds" @picked="onPicked" @create="onCreate" />
        </Drawer>

        <div class="visually-hidden">
            <input :id="inputIds.tracks" type="file" accept=".wav,audio/wav" multiple tabindex="-1" @change="onFiles('tracks', $event)" />
            <input :id="inputIds.stitch" type="file" accept=".wav,audio/wav" multiple tabindex="-1" @change="onFiles('stitch', $event)" />
            <input :id="inputIds.media" type="file" accept="image/*,video/*" multiple tabindex="-1" @change="onFiles('media', $event)" />
        </div>
    </div>
</template>

<style scoped>
.app-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}
.topbar {
    background: var(--p-content-background);
    border-bottom: 1px solid var(--p-content-border-color);
}
.topbar-inner {
    max-width: 80rem;
    margin: 0 auto;
    padding: 0.6rem 1.5rem;
    display: flex;
    align-items: center;
    gap: 1.5rem;
    min-height: 3.5rem;
}
.brand { display: flex; align-items: center; min-width: 0; }
.brand-logo { height: 2rem; width: auto; max-width: 100%; display: block; }
:global(.dark) .brand-logo { content: url('/images/logo-dark.png'); }
.primary-nav { display: flex; gap: 0.25rem; }
.nav-link {
    padding: 0.45rem 0.8rem;
    border-radius: 6px;
    text-decoration: none;
    color: var(--p-text-muted-color);
    font-weight: 500;
}
.nav-link:hover { color: var(--p-text-color); background: var(--p-content-hover-background); }
.nav-link.on { color: var(--p-primary-color); }
.spacer { flex: 1; }
.user-button { white-space: nowrap; }
.user-name { margin: 0 0.5rem; font-weight: 500; }
.back {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    color: var(--p-text-color);
    text-decoration: none;
    font-weight: 500;
}
.back span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.page-header {
    background: var(--p-surface-0);
    border-bottom: 1px solid var(--p-surface-200);
    padding: 1.5rem 0;
}
.page-crumbs { margin-bottom: 0.4rem; }
.page-main {
    flex: 1;
    padding: 2rem 0;
}
.container {
    max-width: 80rem;
    margin: 0 auto;
    padding: 0 1.5rem;
}
.visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
}
.sm-only { display: none; }

.tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 900;
    grid-template-columns: repeat(5, 1fr);
    align-items: end;
    background: var(--p-content-background);
    border-top: 1px solid var(--p-content-border-color);
    padding: 0.35rem 0.25rem calc(0.35rem + env(safe-area-inset-bottom, 0px));
}
.tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    background: none;
    border: 0;
    padding: 0.2rem 0;
    font: inherit;
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--p-text-muted-color);
    text-decoration: none;
    cursor: pointer;
}
.tab i { font-size: 1.15rem; }
.tab.on { color: var(--p-primary-color); }
.plus {
    width: 2.75rem;
    height: 2.75rem;
    margin-top: -1rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--p-primary-color);
    color: var(--p-primary-contrast-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

@media (max-width: 640px) {
    .lg-only { display: none !important; }
    .sm-only { display: flex; }
    .tabbar.sm-only { display: grid; }
    .topbar-inner { padding: 0.5rem 1rem; gap: 0.75rem; min-height: 3rem; }
    .brand-logo { height: 1.75rem; }
    .page-header { padding: 1rem 0; }
    .page-main { padding: 1.25rem 0 calc(5rem + env(safe-area-inset-bottom, 0px)); }
    .immersive .page-main { padding-bottom: 1.25rem; }
    .container { padding: 0 1rem; }
}
:global(.new-sheet.p-drawer-bottom) { height: auto !important; border-radius: 16px 16px 0 0; padding-bottom: env(safe-area-inset-bottom, 0px); }
</style>
