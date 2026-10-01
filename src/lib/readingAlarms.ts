import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Local notifications only: reading alarms fire offline and carry no patient data.
const supported = Platform.OS === "ios" || Platform.OS === "android";
let configured = false;

function configure() {
  if (configured || !supported) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === "android") {
    void Notifications.setNotificationChannelAsync("reading-timers", {
      name: "Reading timers",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

async function ensurePermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Schedules a local alarm; returns its id, or undefined when unsupported or not permitted. */
export async function scheduleReadingAlarm(seconds: number, title: string, body: string) {
  if (!supported) return undefined;
  try {
    configure();
    if (!(await ensurePermission())) return undefined;
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId: "reading-timers",
      },
    });
  } catch (error) {
    console.warn("Could not schedule reading alarm.", error);
    return undefined;
  }
}

export async function cancelReadingAlarm(id: string | undefined) {
  if (!supported || !id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (error) {
    console.warn("Could not cancel reading alarm.", error);
  }
}
