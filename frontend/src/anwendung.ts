import { SpielverwaltungApi } from './services/SpielverwaltungApi';
import { SpielverwaltungEchtzeit } from './services/SpielverwaltungEchtzeit';
import { AppStore } from './store/AppStore';

export const appStore = new AppStore(new SpielverwaltungApi(), new SpielverwaltungEchtzeit());
