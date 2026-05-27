# Backlog

Living list of deferred work surfaced during recent reviews. Items here were
deliberately scoped out of an earlier PR for size or risk — not bugs that
just slipped through. Grouped by area, tagged by priority.

**Priority key**
- **P0** — Blocks production / data-loss / security exposure / App Store rejection
- **P1** — Visible UX regression or known broken flow for a paying user
- **P2** — Real-impact improvement; not blocking but noticeably better when done
- **P3** — Polish, internal hygiene, "would be nice"

Updated: 2026-05-27 (after PR D: all P1s shipped — `d7907f2`)

---

## Social & Community

- [x] **P1** `SystemMenu` component shipped. `showSystemMenu({title,
  options})` delegates to `Alert.alert` on native and renders a Modal
  sheet on web (mounted at app root via `<SystemMenuRoot/>`). Replaced
  every `Platform.OS === "web"` branch in `SocialFeedScreen`,
  `PostDetailScreen`, `BlockedUsersScreen`. The buggy sequential
  `window.confirm` Report/Block chain is gone. *(Done in `d7907f2`.)*

- [x] **P1** Optimistic like / follow / block rollback. Handlers in
  `SocialFeedScreen`, `PostDetailScreen`, `SocialProfileScreen`,
  `FollowListScreen`, `UserSearchScreen` now do targeted per-row
  rollback (only revert the toggled row, not the whole list, so
  concurrent toggles on other rows survive a failure). *(Done in
  `d7907f2`.)*

- [x] **P1** Delete-post feed invalidation. `client/lib/postEvents.ts`
  exposes `emitPostDeleted` / `onPostDeleted`. `PostDetailScreen`
  emits on successful delete; `SocialFeedScreen` subscribes and drops
  the row so navigate-back doesn't show a stale post. *(Done in
  `d7907f2`.)*

- [x] **P1** NotificationsScreen error state — `error` state +
  `Could not load notifications.` + Retry button, matching the
  `FollowListScreen` pattern. *(Done in `d7907f2`.)*

- [x] **P1** Comments pagination. `PostDetailScreen` now paginates
  comments in pages of 20 via `onEndReached` + `loadMoreComments`.
  *(Done in `d7907f2`.)*

- [x] **P1** Optimistic comment send. Temp comment with negative id
  appended on submit, matched + replaced by `clientId` (uuid, unique
  per send) on success, rolled back + input restored on failure.
  `handleDeleteComment` short-circuits for negative ids (no server
  call). Comments FlatList `keyExtractor` switched to `clientId` to
  avoid duplicate-key warnings. *(Done in `d7907f2`.)*

- [ ] **P2** Pull-to-refresh on feed silently swallows errors —
  `SocialFeedScreen.tsx:191-201` has no catch. Show a transient banner on
  failure. Also re-fetch `getUnreadCountApi` during refresh.

- [x] **P2** Strip dead code from `SocialProfileScreen.tsx` — the
  `editingBio` / `bioText` / `handleSaveBio` branches +
  `updateSocialProfileApi` + `TextInput` imports removed. `isOwnProfile`
  retained to hide follow/block buttons when viewing your own profile.
  *(Done in `28bab09`.)*

- [ ] **P2** Pagination on `SocialProfileScreen` user posts — currently
  fetches only the first page from `getUserPostsFeed`.

- [ ] **P2** Pagination on `NotificationsScreen` — endpoint accepts `page`
  but only page 0 ever loads.

- [ ] **P2** Pagination on `UserSearchScreen` — server returns first batch
  only.

- [ ] **P2** Pagination on `BlockedUsersScreen` — large block lists
  truncate.

- [ ] **P2** `UserSearchScreen` debounced-search race condition: if a slow
  first request completes after a faster second one, stale results
  overwrite fresh. Use AbortController or request-id tracking.

- [ ] **P2** Per-row in-flight busy state on Follow buttons in
  `FollowListScreen` + `UserSearchScreen`. Quick double-taps spam the API.

- [ ] **P2** Notification badge clears immediately on Feed → Notifications
  navigation. Currently the feed only updates the badge on next focus,
  briefly showing a stale count.

- [ ] **P2** Standardize `webSafeAlert` across all social screens.
  Currently auth/settings use the helper; social hand-rolls
  `Platform.OS === "web"` branches.

- [ ] **P2** Delete-comment confirmation — when reporting twice, no UI
  signal that the comment was already reported. Track reported state
  per row.

- [ ] **P2** `PostDetailScreen.tsx:346` hardcoded `lbs` unit — should
  honor the user's `preferredUnits`.

- [ ] **P3** Avatar in `NotificationsScreen` — the API returns
  `actorAvatarUrl` but the screen only renders type-specific Feather
  icons (heart / chat / user). Could render actor avatar with the type
  icon as a small overlay badge.

- [ ] **P3** `SocialProfileScreen.tsx:28-29` validate `route.params.userId`
  before using it. If a malformed deep link arrives with no userId, the
  screen hits `/api/social/users/NaN/profile`.

- [ ] **P3** `Feather` icon inside `<ThemedText>` inline at
  `SocialProfileScreen.tsx:253,256` doesn't render reliably on web.
  Restructure into a flexrow with two Text children.

- [ ] **P3** Server-side dedupe of follow notifications. Currently no
  `(user_id, type, actor_id, reference_id)` unique constraint so
  follow→unfollow→follow generates two follow notifications.

## Web / Desktop

- [x] **P1** Lists stretch edge-to-edge at desktop widths (no max-width).
  Added `width: "100%", maxWidth: 720, alignSelf: "center"` to the
  contentContainerStyle of 7 social FlatLists (Feed, PostDetail,
  SocialProfile, FollowList, UserSearch, Notifications, BlockedUsers).
  Settings + Profile tabs still uncapped — separate follow-up. *(Done in
  `28bab09`.)*

- [ ] **P2** Deep-link-after-auth redirect. Unauth user clicks
  `/community` → lands on Login → after login goes to Onboarding/Home, NOT
  back to `/community`. Needs an auth-aware redirect-after-login mechanism.

- [ ] **P2** Tablet (768–1023px) hamburger drawer. Currently shows the
  mobile bottom-tab bar between those widths — usable but not great. Phase
  2 web migration item.

- [ ] **P2** SEO meta per public route — currently default meta + 4
  hardcoded login-flow titles. Add og:image/title per public page if we
  ever build a marketing site.

- [ ] **P2** Real 1200×630 `og-image.png` (currently using `icon.png` as
  fallback). Social-share previews on Twitter/Slack/LinkedIn use this.

- [ ] **P3** Full hover audit across 247 `Pressable` sites. Web users
  expect hover affordances; native has none. Mostly mechanical, best baked
  into the shared `Button`/`AnimatedPress` components.

- [ ] **P3** Keyboard navigation audit — Tab order, visible focus rings on
  every interactive element. Web a11y baseline.

- [ ] **P3** Cmd+K command palette. Cool but not blocking.

## Accessibility (App Store risk)

- [ ] **P0** `accessibilityLabel` / `accessibilityRole` on all icon-only
  Pressables across the app (~247 sites per earlier audit). App Store
  reviewers run VoiceOver; unlabeled icon buttons are a common rejection.
  Bake into `AnimatedPress` / `Button` shared components for one-pass fix.

- [ ] **P2** `ITSAppUsesNonExemptEncryption: false` in `app.json` `ios.
  infoPlist`. Smooths every TestFlight upload — App Store Connect
  otherwise prompts on every submission.

- [ ] **P2** `NSPhotoLibraryAddUsageDescription` permission string in
  `app.json` — if any flow ever writes to the photo library (e.g.,
  saving a workout summary screenshot), iOS will crash without this.

## Performance

- [ ] **P1** `getFoodLogs` returns up to 500 rows with `image_data` base64
  inline (`server/db.ts:826-846`). Cold-start payload is tens of MB for
  users with many food photos. Drop `image_data` from list query; add a
  separate `GET /api/food-logs/:clientId/image` endpoint OR paginate.

- [x] **P1** Lowered pg pool `max` from 30 to 6 (`server/db.ts`). 4
  workers × 6 = 24 connections, well under Railway's Hobby cap.
  *(Done in `d7907f2`.)*

- [ ] **P2** Graceful SIGTERM handler (`server/index.ts`). Currently every
  Railway redeploy drops in-flight requests and leaks DB connections.

- [ ] **P2** `getFeedPosts` has 3 visibility subqueries each scanning
  `follows` / `user_blocks` per page. Materialize "visible_user_ids" CTE
  once per query.

- [ ] **P2** N+1 in workout analytics (`server/routes.ts:1271-1339`).
  Three separate queries plus `jsonb_array_elements` over all workouts.

- [ ] **P2** FlatList renderItem closures recreated per render in
  `SocialFeedScreen`, `PostDetailScreen`, `FollowListScreen`,
  `BlockedUsersScreen`, `UserSearchScreen`, `NotificationsScreen`,
  `SocialProfileScreen`. Extract memoized row components.

- [ ] **P3** Decide TanStack Query: rip it out (currently
  `QueryClientProvider` mounted, 0 `useQuery`/`useMutation` calls) or
  migrate at least one screen. Pure bundle weight today.

## Mobile / App Store

- [ ] **P0** Decide whether to change `ios.bundleIdentifier` /
  `android.package` (`fitness.mergefitness.app` → e.g.
  `com.gbolofitness.app`). The existing identifiers are tied to App
  Store Connect (`ascAppId: 6759593482` in eas.json). Changing them
  orphans the listing.

- [ ] **P1** Email sender domain — currently
  `support@mergefitness.fitness`. Switch to `support@gbolofitness.com`
  after DNS is configured on Resend. Touches `server/auth.ts:254, 283,
  636` (TODO comments already in place).

- [ ] **P1** Stand up `gbolofitness.com/privacy` and `/terms` pages.
  `SettingsScreen.tsx:221, 234` links point there but they 404 today.

- [ ] **P2** EAS production build needs `JWT_SECRET` set as an EAS
  secret (server reads it; EAS bundle doesn't). Already in Railway, not
  yet in EAS. Only blocks if EAS build runs server code (it doesn't —
  just builds the JS bundle), so likely not needed; verify before first
  `eas build`.

- [ ] **P2** Universal Links / App Links so clicking the email
  confirmation link in a mobile browser opens the installed app instead
  of the web confirm page.

- [ ] **P2** Migrate the 90 inline `Haptics.*` call sites to the
  `useHaptics()` adapter hook that already exists in
  `client/hooks/useHaptics.ts`. Mechanical sed-able change.

- [ ] **P2** Wire `useEscapeKey()` into actual modal screens. Hook
  exists in `client/hooks/useEscapeKey.ts` but no modal uses it yet.

## Infrastructure / Deploy

- [x] **P1** Deleted dead `/api/sync/bulk` endpoint. Zero callers AND
  the transaction wrapping was a no-op (helpers used `pool.query` not
  `client.query`). *(Done in `d7907f2`.)*

- [ ] **P2** Bump Node version pin in Railway. Deploy log shows Node
  18.20.5 which reached end-of-life April 2026. Add
  `"engines": { "node": ">=20" }` to `package.json` so Railway picks
  20+ on next deploy.

- [ ] **P2** Rotate `WORKOUT_API_KEY` exposed in the deleted `.replit`
  file (`03f36d3c4b8e90c3ba87e5c4251acfc293e796dc15a04956ea985da67da6a84e`
  is in git history). Marked "burned" but should be rotated at the
  provider if still active anywhere.

- [ ] **P2** 35 npm advisories (1 low / 24 moderate / 10 high). Most
  require Expo SDK 56 major bump. Reassess post-v1 launch.

- [ ] **P3** Pre-commit hooks (husky + lint-staged) running prettier +
  tsc on staged files. Currently lint is opt-in.

- [ ] **P3** ESLint scope split — `eslint-config-expo` is RN-focused
  and is being applied to `server/` files too, producing noise. Carve
  out a separate eslint block for `server/**`.

## Tech Debt / TypeScript

- [ ] **P2** Fix component prop types that produce the 11 baseline TS
  errors — `Card.style` should be `StyleProp<ViewStyle>` not `ViewStyle`
  (kills 4 errors), `SkeletonProps` should accept `count`/`lines`
  (kills 4 errors), `ButtonProps` should accept `testID` (1 error).
  ~8 of 11 baseline errors fixable in 3 edits.

- [ ] **P3** Two `server/routes.ts` errors at lines 484, 965 — Express 5
  `req.params.X` typing is `string | string[]`. Add explicit string
  cast or validation.

- [ ] **P3** Drop `expo-image` from `package.json` (declared but never
  imported) OR adopt it for `SocialFeedScreen` image rendering. Either
  way removes the lie in deps.

- [ ] **P3** Drop `react-leaflet` / `leaflet` deps if `MapDisplay.tsx`
  stays on raw leaflet via dynamic import. Currently both are installed
  but `react-leaflet` is unused.

- [ ] **P3** Console-log audit. Dozens of `console.log`/`console.error`
  in catch blocks across client and server. Stripped from logs in prod
  for response bodies (commit `b404746`) but the dev noise stays. Route
  through a real logger (pino on server, debug-prefixed on client) or
  strip in production builds.

## Auth / Security (post-launch)

- [ ] **P2** Email-existence enumeration on register is closed via the
  confirm-via-email flow (commit `cf00296`) but the registration
  endpoint still has timing variance (~1-3ms from the JWT signing
  on the new-user branch). Negligible in practice; document.

- [ ] **P2** Apple Sign-In / Google Sign-In via OAuth. Apple Sign-In
  becomes mandatory at App Store level once any other social login
  is added. Triggers a Supabase Auth migration consideration (see
  `auth security review` from earlier conversation).

- [ ] **P2** Magic-link login as a passwordless option.

- [ ] **P2** TOTP / 2FA for account security. Increasingly table-stakes
  for fitness apps tracking health data.

- [ ] **P2** "Active sessions" UI + "Log out everywhere" button.
  Currently only triggered indirectly by password change.

- [ ] **P3** Refresh-token rotation. The 30-day JWT is the only
  credential; stolen tokens work for 30 days.

- [ ] **P3** Per-user CAPTCHA on register / forgot-password if bot
  signups become a real problem.

- [ ] **P3** Password breach check against HaveIBeenPwned at register
  time.

## Phase 2/3 Web Migration

- [ ] **P2** Per-screen responsive layouts for the ~30 client screens
  beyond what bottom-tabs / sidebar already give us. Each screen needs
  hand-tuned desktop/tablet/mobile layouts.

- [ ] **P2** Skeleton states on every data-fetched screen — currently
  only some have them.

- [ ] **P3** More platform-adapter hooks: `useStorage()`,
  `useNotifications()`, `useShare()`, `useClipboard()`. Pattern set by
  `usePlatform` / `useHaptics`.

## Documentation

- [ ] **P3** Replace `design_guidelines.md` with an `ARCHITECTURE.md`
  reflecting the current stack: Expo + Express + Postgres on Railway,
  Brand palette, auth flow, social model.

- [ ] **P3** Onboarding doc for future contributors: how to run server
  + web bundle locally, env vars required, where icons come from, how
  to regenerate them.

---

## Notes

- The 6 staged commits from the security/auth pile already landed
  earlier in this session — not in backlog.
- Web v1 was shipped to `fitlog-production-163a.up.railway.app` —
  see git log between `5da6923` and HEAD.
- "P0 = blocks production" — there are currently 2 P0 items
  (accessibility labels for App Store; bundle ID decision). The app
  is live for web users; both are App-Store-launch concerns, not
  web-v1 concerns.
