import 'd3';
// Load the "plugins"
import 'd3-selection';
import 'd3-zoom';
import '../styles/app.scss';
import spotify from './spotify';
import ui from './ui';

spotify.authorize();
ui.init();
