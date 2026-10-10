import { Platform, Share } from "react-native";

import { webSafeAlert } from "@/lib/webSafeAlert";

function appOrigin(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }
  const domain = process.env.EXPO_PUBLIC_DOMAIN || "";
  return domain.startsWith("http") ? domain : `https://${domain}`;
}

// Share a link to a community post: the native share sheet where one
// exists (phones, including mobile browsers), otherwise copy to the
// clipboard. Recipients who open it land on the post and can save the
// workout from there.
export async function sharePostLink(postId: number, title: string) {
  const url = `${appOrigin().replace(/\/$/, "")}/posts/${postId}`;
  try {
    if (Platform.OS !== "web") {
      await Share.share({ message: `${title}\n${url}`, url });
      return;
    }
    const nav = typeof navigator !== "undefined" ? (navigator as any) : null;
    if (nav?.share) {
      await nav.share({ title, url });
      return;
    }
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(url);
      webSafeAlert("Link copied", "Paste it anywhere to share this workout.");
      return;
    }
    webSafeAlert("Share this link", url);
  } catch (e: any) {
    // The user closing the share sheet is not an error.
    if (e?.name === "AbortError") return;
    webSafeAlert("Share this link", url);
  }
}
