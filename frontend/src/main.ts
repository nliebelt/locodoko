import Phaser from 'phaser';
import './styles.css';
import { appStore } from './anwendung';
import { BootSzene } from './szenen/BootSzene';
import { LobbySzene } from './szenen/LobbySzene';
import { TischSzene } from './szenen/TischSzene';

const spiel = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'spiel-root',
  backgroundColor: '#0f5132',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },
  scene: [BootSzene, LobbySzene, TischSzene]
});

window.addEventListener('beforeunload', () => {
  appStore.trennen();
  spiel.destroy(true);
});
