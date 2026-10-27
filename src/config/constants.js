// src/config/constants.js — BusTrack Master Constants File
// Session 1 Foundation Update — adds DELAY_REASONS, TRAFFIC_SEGMENTS,
// BUS_CHANGE_REASONS, DEFAULT_USER_PREFS, DEFAULT_DRIVER_PREFS

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

export const COLORS = {
  black: '#000000',
  white: '#FFFFFF',

  // Backgrounds
  background: '#0A0A0A',
  surface: '#141414',
  surfaceElevated: '#1C1C1C',
  surfaceHigh: '#242424',

  // Borders
  border: '#2A2A2A',
  borderLight: '#333333',

  // Brand
  primary: '#00A86B',
  primaryDark: '#008F5A',
  primaryFaded: 'rgba(0, 168, 107, 0.12)',

  // Semantic
  success: '#00A86B',
  warning: '#F5A623',
  warningFaded: 'rgba(245, 166, 35, 0.12)',
  danger: '#E53935',
  dangerFaded: 'rgba(229, 57, 53, 0.12)',
  info: '#2196F3',
  infoFaded: 'rgba(33, 150, 243, 0.12)',
  purple: '#9C27B0',
  purpleFaded: 'rgba(156, 39, 176, 0.12)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#8A8A8A',
  textMuted: '#4A4A4A',

  // Status aliases
  onTime: '#00A86B',
  delayed: '#F5A623',
  cancelled: '#E53935',
  full: '#9C27B0',

  // Route colours
  route520: '#00A86B',
  route525: '#2196F3',
  route530: '#F5A623',

  // Traffic severity colours (used on map overlays)
  trafficClear:    '#00A86B',
  trafficModerate: '#F5A623',
  trafficHeavy:    '#E53935',
};

export const FONTS = {
  sizes: {
    xs: 11, sm: 13, md: 15, lg: 17,
    xl: 20, xxl: 24, xxxl: 32, display: 40,
  },
  weights: {
    regular: '400', medium: '500',
    semibold: '600', bold: '700', heavy: '800',
  },
};

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const RADIUS  = { sm: 6, md: 12, lg: 16, xl: 24, full: 999 };

// ─────────────────────────────────────────────────────────────────────────────
// APP CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const USER_ROLES   = { guest: 'guest', user: 'user', driver: 'driver', admin: 'admin' };
export const ROUTE_STATUS = { onTime: 'ON_TIME', delayed: 'DELAYED', cancelled: 'CANCELLED', full: 'FULL' };
export const DIRECTIONS   = { OUTBOUND: 'outbound', INBOUND: 'inbound' };
export const DURBAN_REGION = { latitude: -29.8700, longitude: 30.9850, latitudeDelta: 0.12, longitudeDelta: 0.12 };

// ─────────────────────────────────────────────────────────────────────────────
// DELAY REASONS
// Used in DelayReasonModal (driver side) and displayed to users in
// LiveTrackingScreen when a bus is delayed.
// ─────────────────────────────────────────────────────────────────────────────

export const DELAY_REASONS = [
  { key: 'traffic',    label: 'Heavy Traffic',   icon: 'car-outline',                color: '#F5A623' },
  { key: 'accident',   label: 'Accident',         icon: 'warning-outline',            color: '#E53935' },
  { key: 'breakdown',  label: 'Bus Breakdown',    icon: 'construct-outline',          color: '#795548' },
  { key: 'weather',    label: 'Bad Weather',      icon: 'rainy-outline',              color: '#2196F3' },
  { key: 'passenger',  label: 'Passenger Issue',  icon: 'people-outline',             color: '#9C27B0' },
  { key: 'roadworks',  label: 'Roadworks',        icon: 'build-outline',              color: '#FF9800' },
  { key: 'other',      label: 'Other',            icon: 'ellipsis-horizontal-outline',color: '#8A8A8A' },
];

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATED TRAFFIC SEGMENTS
//
// Each entry describes a road segment between two consecutive stop indices
// on a route that experiences congestion. peakHours is an array of 24h clock
// hours when that segment is congested. baseSeverity is the congestion level
// during those hours.
//
// trafficService.js reads this object to build the map overlay and to suggest
// delay reports to the driver.
// ─────────────────────────────────────────────────────────────────────────────

export const TRAFFIC_SEGMENTS = {
  route_520: [
    {
      fromStopIndex: 0, toStopIndex: 1,
      label: 'Woodlands Rd',
      peakHours: [7, 8],
      baseSeverity: 'moderate',
      extraDelayMinutes: 4,
    },
    {
      fromStopIndex: 3, toStopIndex: 4,
      label: 'Umbilo Rd',
      peakHours: [7, 8, 17, 18],
      baseSeverity: 'heavy',
      extraDelayMinutes: 10,
    },
    {
      fromStopIndex: 5, toStopIndex: 6,
      label: 'Musgrave Ave',
      peakHours: [8, 9, 17, 18],
      baseSeverity: 'moderate',
      extraDelayMinutes: 5,
    },
    {
      fromStopIndex: 7, toStopIndex: 8,
      label: 'West St CBD',
      peakHours: [7, 8, 9, 16, 17, 18],
      baseSeverity: 'heavy',
      extraDelayMinutes: 12,
    },
    {
      fromStopIndex: 8, toStopIndex: 9,
      label: 'Pine St → Terminus',
      peakHours: [8, 9, 17],
      baseSeverity: 'moderate',
      extraDelayMinutes: 5,
    },
  ],
  route_525: [
    {
      fromStopIndex: 0, toStopIndex: 1,
      label: 'Grey St / CBD exit',
      peakHours: [7, 8, 17, 18],
      baseSeverity: 'moderate',
      extraDelayMinutes: 6,
    },
    {
      fromStopIndex: 2, toStopIndex: 3,
      label: 'Berea → Westville',
      peakHours: [7, 8, 17],
      baseSeverity: 'heavy',
      extraDelayMinutes: 10,
    },
    {
      fromStopIndex: 4, toStopIndex: 5,
      label: 'Fields Hill',
      peakHours: [7, 8, 17, 18],
      baseSeverity: 'moderate',
      extraDelayMinutes: 5,
    },
  ],
  route_530: [
    {
      fromStopIndex: 0, toStopIndex: 1,
      label: 'Warwick Jct',
      peakHours: [6, 7, 8, 17, 18],
      baseSeverity: 'heavy',
      extraDelayMinutes: 12,
    },
    {
      fromStopIndex: 3, toStopIndex: 4,
      label: 'Higginson Hwy',
      peakHours: [7, 8, 16, 17],
      baseSeverity: 'moderate',
      extraDelayMinutes: 7,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// BUS CHANGE REASONS
// Used in the admin/driver bus-change flow.
// ─────────────────────────────────────────────────────────────────────────────

export const BUS_CHANGE_REASONS = [
  { key: 'breakdown',    label: 'Mechanical Breakdown' },
  { key: 'maintenance',  label: 'Scheduled Maintenance' },
  { key: 'capacity',     label: 'Capacity Issue — bus full' },
  { key: 'accident',     label: 'Accident / Damage' },
  { key: 'reallocation', label: 'Route Reallocation' },
  { key: 'other',        label: 'Other' },
];

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT PREFERENCES
// Stored in Firestore under users/{uid} and read by settings screens.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_USER_PREFS = {
  notificationsEnabled: true,
  alertStopsAway: 2,       // notify user when bus is this many stops away
  soundEnabled: true,
  savedStops: [],          // array of stop ids the user has saved
  preferredRoute: null,    // routeId string or null
};

export const DEFAULT_DRIVER_PREFS = {
  soundAlertsEnabled: true,
  autoSuggestDelay: true,  // show a suggestion banner when entering heavy traffic
  offlineModeEnabled: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 520 — Woodlands Circle → City Terminus (10 stops)
// ─────────────────────────────────────────────────────────────────────────────

export const ROUTE_520_STOPS = [
  { id:'520_1',  name:'Woodlands Circle',  latitude:-29.89187, longitude:30.94325, order:1,  landmark:'Woodlands Shopping Centre' },
  { id:'520_2',  name:'Radcliffe Road',    latitude:-29.88800, longitude:30.94800, order:2,  landmark:'Radcliffe Road & Kenyon Howden Rd' },
  { id:'520_3',  name:'Kenyon Howden Road',latitude:-29.88000, longitude:30.95600, order:3,  landmark:'Kenyon Howden & Umbilo Road Junction' },
  { id:'520_4',  name:'Umbilo Road',       latitude:-29.87667, longitude:30.99060, order:4,  landmark:'Umbilo Road stop' },
  { id:'520_5',  name:'Glenwood',          latitude:-29.87340, longitude:31.00550, order:5,  landmark:'Berea Road & Glenwood junction' },
  { id:'520_6',  name:'Musgrave Centre',   latitude:-29.84833, longitude:30.99793, order:6,  landmark:'Musgrave Centre Bus Stop' },
  { id:'520_7',  name:'Berea Road',        latitude:-29.85716, longitude:31.00560, order:7,  landmark:'Berea Road heading into CBD' },
  { id:'520_8',  name:'West Street',       latitude:-29.85804, longitude:31.02601, order:8,  landmark:'West Street CBD' },
  { id:'520_9',  name:'Pine Street',       latitude:-29.85900, longitude:31.02230, order:9,  landmark:'Pine Street near City Hall' },
  { id:'520_10', name:'City Terminus',     latitude:-29.84613, longitude:31.02552, order:10, landmark:'Durban City Bus Terminus' },
];

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 525 — City Terminus → Pinetown CBD (6 stops)
// ─────────────────────────────────────────────────────────────────────────────

export const ROUTE_525_STOPS = [
  { id:'525_1', name:'City Terminus',    latitude:-29.84613, longitude:31.02552, order:1, landmark:'Durban City Hall' },
  { id:'525_2', name:'Grey Street',      latitude:-29.85160, longitude:31.01680, order:2, landmark:'Grey Street Mosque area' },
  { id:'525_3', name:'Tollgate / Berea', latitude:-29.85720, longitude:31.00560, order:3, landmark:'Berea Road Tollgate' },
  { id:'525_4', name:'Westville Mall',   latitude:-29.83670, longitude:30.92940, order:4, landmark:'Westville Shopping Centre' },
  { id:'525_5', name:'Fields Hill',      latitude:-29.81910, longitude:30.90450, order:5, landmark:'Fields Hill descending' },
  { id:'525_6', name:'Pinetown CBD',     latitude:-29.81820, longitude:30.86110, order:6, landmark:'Pinetown Main Road Terminus' },
];

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 530 — City Terminus → Umlazi (6 stops)
// ─────────────────────────────────────────────────────────────────────────────

export const ROUTE_530_STOPS = [
  { id:'530_1', name:'City Terminus',     latitude:-29.84613, longitude:31.02552, order:1, landmark:'Durban City Hall' },
  { id:'530_2', name:'Warwick Triangle',  latitude:-29.84790, longitude:31.01530, order:2, landmark:'Warwick Junction transport hub' },
  { id:'530_3', name:'Umbilo Road',       latitude:-29.87670, longitude:30.99060, order:3, landmark:'Umbilo Road southbound' },
  { id:'530_4', name:'Higginson Highway', latitude:-29.91200, longitude:30.94640, order:4, landmark:'Higginson Hwy & Edwin Swales' },
  { id:'530_5', name:'Umlazi H Section',  latitude:-29.96300, longitude:30.89300, order:5, landmark:'Umlazi H Section main road' },
  { id:'530_6', name:'Umlazi Terminus',   latitude:-29.97540, longitude:30.88210, order:6, landmark:'Umlazi Bus Terminus' },
];

// ─────────────────────────────────────────────────────────────────────────────
// REVERSE STOPS (inbound direction)
// ─────────────────────────────────────────────────────────────────────────────

export const ROUTE_520_STOPS_REVERSE = [...ROUTE_520_STOPS].reverse().map((s, i) => ({ ...s, id:`520r_${i+1}`, order: i+1 }));
export const ROUTE_525_STOPS_REVERSE = [...ROUTE_525_STOPS].reverse().map((s, i) => ({ ...s, id:`525r_${i+1}`, order: i+1 }));
export const ROUTE_530_STOPS_REVERSE = [...ROUTE_530_STOPS].reverse().map((s, i) => ({ ...s, id:`530r_${i+1}`, order: i+1 }));

// ─────────────────────────────────────────────────────────────────────────────
// TIMETABLES
// ─────────────────────────────────────────────────────────────────────────────

const wkOut = ['06:00','06:30','07:00','08:00','09:00','10:00','12:00','15:00','16:00','17:00','18:00'];
const wkIn  = ['07:00','07:30','08:00','09:00','10:00','11:00','13:00','16:00','17:00','18:00','19:00'];
const sat   = ['07:00','08:00','09:00','10:00','12:00','14:00','16:00','18:00'];
const sun   = ['08:00','09:00','10:00','12:00','14:00','16:00','18:00'];

const makeTimetable = () => ({
  weekday:  { outbound: wkOut, inbound: wkIn },
  saturday: { outbound: sat,   inbound: sat  },
  sunday:   { outbound: sun,   inbound: sun  },
});

export const ROUTE_520_TIMETABLE = makeTimetable();
export const ROUTE_525_TIMETABLE = makeTimetable();
export const ROUTE_530_TIMETABLE = makeTimetable();

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE REGISTRY — single source of truth for all route data
// ─────────────────────────────────────────────────────────────────────────────

export const ROUTES = {
  route_520: {
    id: 'route_520',
    name: 'Route 520',
    description: 'Woodlands → City',
    color: '#00A86B',
    outboundStops: ROUTE_520_STOPS,
    inboundStops:  ROUTE_520_STOPS_REVERSE,
    timetable:     ROUTE_520_TIMETABLE,
    busId:         'bus_520_001',
    busLabel:      'BT-520',
    baseFare:      6.50,
    farePerStop:   1.20,
  },
  route_525: {
    id: 'route_525',
    name: 'Route 525',
    description: 'City → Pinetown',
    color: '#2196F3',
    outboundStops: ROUTE_525_STOPS,
    inboundStops:  ROUTE_525_STOPS_REVERSE,
    timetable:     ROUTE_525_TIMETABLE,
    busId:         'bus_525_001',
    busLabel:      'BT-525',
    baseFare:      6.50,
    farePerStop:   1.20,
  },
  route_530: {
    id: 'route_530',
    name: 'Route 530',
    description: 'City → Umlazi',
    color: '#F5A623',
    outboundStops: ROUTE_530_STOPS,
    inboundStops:  ROUTE_530_STOPS_REVERSE,
    timetable:     ROUTE_530_TIMETABLE,
    busId:         'bus_530_001',
    busLabel:      'BT-530',
    baseFare:      8.00,
    farePerStop:   1.50,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// INCIDENT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export const INCIDENT_TYPES = {
  accident:  { severity:3, avg_delay_min:25, label:'Accident',          color:'#E53935' },
  protest:   { severity:3, avg_delay_min:45, label:'Road Protest',      color:'#9C27B0' },
  flooding:  { severity:2, avg_delay_min:30, label:'Flooding',          color:'#2196F3' },
  roadworks: { severity:1, avg_delay_min:15, label:'Roadworks',         color:'#FF9800' },
  breakdown: { severity:2, avg_delay_min:20, label:'Vehicle Breakdown', color:'#795548' },
};