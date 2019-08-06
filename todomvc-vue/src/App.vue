<template>
    <router-view></router-view>
</template>

<script lang="ts">
import Vue from 'vue';
import App from './components/TodoApp.vue';
import VueRouter, { RouteConfig } from 'vue-router';


const viewNames = ['completed', 'active', '*'];
const routes = viewNames.map((view): RouteConfig => ({
  path: '/' + view,
  component: App,
  props: {
    currentView: view === '*' ? 'all' : view,
  },
}));

const router = new VueRouter({
  routes,
});

export default Vue.extend({
    router,
});
</script>
