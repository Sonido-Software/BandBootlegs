<script setup>
import { Link } from '@inertiajs/vue3';
import Card from 'primevue/card';
</script>

<template>
    <div class="guest-shell">
        <Link href="/" class="brand">
            <img class="brand-logo" src="/images/logo.png" alt="Band Bootlegs" />
        </Link>
        <Card class="guest-card">
            <template #content>
                <slot />
            </template>
        </Card>
    </div>
</template>

<style scoped>
.guest-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 2rem 1rem;
}
.brand { display: flex; justify-content: center; }
.brand-logo { height: 3.5rem; width: auto; display: block; max-width: 100%; }
:global(.dark) .brand-logo { content: url('/images/logo-dark.png'); }
.guest-card {
    width: 100%;
    max-width: 28rem;
}
</style>
