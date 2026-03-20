import Phaser from 'phaser';
import './styles.css';
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
  scene: [TischSzene]
});

window.addEventListener('beforeunload', () => {
  spiel.destroy(true);
});
