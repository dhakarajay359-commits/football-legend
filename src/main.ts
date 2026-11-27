import './styles/main.css';
import { App } from './App.js';
import { cgSDK } from './sdk/CrazyGamesSDK.js';

cgSDK.init();
const root = document.getElementById('app');
if (root) {
  new App(root);
}
