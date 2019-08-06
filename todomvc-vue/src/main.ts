import Vue from 'vue';
import App from './App.vue';
import VueRouter, { RouteConfig } from 'vue-router';
import VueRx from 'vue-rx';


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

Vue.use(VueRouter);
Vue.use(VueRx);

Vue.config.productionTip = false;

new Vue({
  router,
  render: (h) => h(App),
}).$mount('#todoapp');
