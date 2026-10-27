// index.web.js - Web entry point (no mobile-specific imports)
import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

// Web-only app - no react-native-maps, no native-stack
import AppWeb from './App.web';

registerRootComponent(AppWeb);