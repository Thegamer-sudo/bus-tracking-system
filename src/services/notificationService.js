import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Tell Expo how to handle notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const registerForNotifications = async () => {
  // Only works on real devices
  if (!Device.isDevice) {
    console.log('[Notifications] Skipped — not a real device');
    return;
  }

  // Create Android channel FIRST — without this Android silently drops everything
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('bustrack-alerts', {
      name: 'BusTrack Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableLights: true,
      lightColor: '#00A86B',
    });
  }

  // Check and request permission
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission denied by user');
    return;
  }

  // DO NOT call getExpoPushTokenAsync() — that is for remote notifications
  // and was removed from Expo Go in SDK 53. We only need local notifications.
  console.log('[Notifications] Ready — local notifications enabled ✅');
};

export const sendLocalNotification = async (title, body, data = {}) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: 'bustrack-alerts' }),
      },
      trigger: null, // null = show immediately
    });
  } catch (e) {
    console.error('[Notifications] Failed to send:', e.message);
  }
};

export const checkBusApproaching = async (busStopIndex, userSelectedStopIndex, stopName) => {
  const stopsAway = userSelectedStopIndex - busStopIndex;

  if (stopsAway === 2) {
    await sendLocalNotification(
      '🚌 Bus approaching',
      `Your bus is 2 stops away from ${stopName}. Get ready.`,
      { type: 'approaching', stopsAway: 2 }
    );
  } else if (stopsAway === 1) {
    await sendLocalNotification(
      '⚡ Bus almost here',
      `Your bus is 1 stop away from ${stopName}. Move to the stop now.`,
      { type: 'almost_here', stopsAway: 1 }
    );
  } else if (stopsAway === 0) {
    await sendLocalNotification(
      '✅ Bus has arrived',
      `Your bus is now at ${stopName}. Board now.`,
      { type: 'arrived', stopsAway: 0 }
    );
  }
};