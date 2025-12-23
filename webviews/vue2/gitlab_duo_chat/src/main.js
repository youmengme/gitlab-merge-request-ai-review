import Vue from 'vue';
import App from './App.vue';

Vue.config.productionTip = false;

const el = document.getElementById('app');
let initialState = {};
try {
  initialState = JSON.parse(document.querySelector('[data-initial-state]').innerHTML);
  console.log('successfully parsed initial state');
} catch (e) {
  console.error('Error when parsing initial state', e);
}

try {
  new Vue({
    el,
    render(createElement) {
      return createElement(App, {
        props: {
          ...initialState,
        },
      });
    },
  }).$mount();
} catch (e) {
  console.error('Duo Chat Vue initialization failed', e);
}
