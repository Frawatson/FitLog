import { Alert, Platform } from "react-native";

// React Native's Alert.alert is a no-op on react-native-web — the user
// clicks a button, the handler fires, then nothing visible happens and
// any onPress callback never runs. This wrapper uses window.alert on web
// (which blocks until the user dismisses) then invokes onOk, and falls
// back to the native Alert with an OK button elsewhere.
export function webSafeAlert(
  title: string,
  message: string,
  onOk?: () => void,
): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && typeof window.alert === "function") {
      window.alert(`${title}\n\n${message}`);
    }
    onOk?.();
    return;
  }
  Alert.alert(title, message, onOk ? [{ text: "OK", onPress: onOk }] : undefined);
}
