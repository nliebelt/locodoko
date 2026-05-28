import { SpielverwaltungApi } from './services/SpielverwaltungApi';
import { SpielverwaltungEchtzeit } from './services/SpielverwaltungEchtzeit';
import { AppStore } from './store/AppStore';

const api = new SpielverwaltungApi();
export const appStore = new AppStore(api, new SpielverwaltungEchtzeit());
api.setzeMeldungCallback((text, typ) => appStore.setMeldung(text, typ));
