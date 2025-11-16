import { createApp } from 'vue'
import App from './App.vue'

// primevue
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import Toast from 'primevue/toast';
import Tooltip from 'primevue/tooltip';
import Aura from '@primevue/themes/aura'
import {ConfirmationService} from "primevue";

// apexcharts
import VueApexCharts from "vue3-apexcharts";

// styles
import "./style.css"


// create
const app = createApp(App)

// use the PrimeVue library
app.use(PrimeVue, {
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
app.use(ToastService);
app.use(ConfirmationService)
app.component('Toast', Toast);
app.component('apexchart', VueApexCharts)
app.directive('tooltip', Tooltip);
app.mount('#app')