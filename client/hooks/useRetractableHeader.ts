import {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

// Visual height of the retractable header content (without safe-area top).
// Exported so screens can pad their content below it.
export const RETRACTABLE_HEADER_HEIGHT = 52;

// Thresholds chosen to feel like the Twitter/Instagram pattern:
//  - any time you're within SHOW_AT_TOP px of the top, the header is shown
//  - a downward scroll of more than SCROLL_DELTA collapses it
//  - an upward scroll of more than SCROLL_DELTA re-expands it
const SHOW_AT_TOP = 12;
const SCROLL_DELTA = 4;
const ANIM_MS = 180;

export function useRetractableHeader() {
  // translateY in pixels relative to natural position. 0 = visible,
  // -RETRACTABLE_HEADER_HEIGHT = fully hidden upward.
  const translateY = useSharedValue(0);
  const lastY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      const delta = y - lastY.value;

      if (y < SHOW_AT_TOP) {
        translateY.value = withTiming(0, { duration: ANIM_MS });
      } else if (delta > SCROLL_DELTA) {
        // Scrolling down (toward more content) — hide.
        translateY.value = withTiming(-RETRACTABLE_HEADER_HEIGHT, { duration: ANIM_MS });
      } else if (delta < -SCROLL_DELTA) {
        // Scrolling up (back toward the top) — show.
        translateY.value = withTiming(0, { duration: ANIM_MS });
      }

      lastY.value = y;
    },
  });

  const headerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return { scrollHandler, headerAnimStyle };
}
