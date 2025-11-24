import { createApp } from 'vue'
import App from './components/App.vue'

// the page router
import router from "@/router/index.js";

// primevue
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import Toast from 'primevue/toast';
import Tooltip from 'primevue/tooltip';
import Aura from '@primevue/themes/aura'
import {ConfirmationService} from "primevue";
import Ripple from 'primevue/ripple';

// vue-code-block
import { createVCodeBlock } from '@wdns/vue-code-block';

// apexcharts
import VueApexCharts from "vue3-apexcharts";

// styles
import "./style.css"

// vue flow styles
/* Vue Flow Core Styles */
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

/* Vue Flow Add-on Styles */
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
/* ----------------------- */


// create
const app = createApp(App)
const VCodeBlock = createVCodeBlock();

// use the PrimeVue library
app.use(PrimeVue, {
    ripple: true,
    theme: {
        preset: Aura,
        options: {
            prefix: 'p',
            darkModeSelector: 'system',
            cssLayer: false
        }
    }
});

// use toast for notifications
app.use(router);
app.use(ToastService);
app.use(ConfirmationService);
app.component('Toast', Toast);
app.component('apexchart', VueApexCharts)
app.component('VCodeBlock', VCodeBlock);
app.directive('tooltip', Tooltip);
app.directive('ripple', Ripple);
app.mount('#app')