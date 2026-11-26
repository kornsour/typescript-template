/**
 * Deep-link scheme of the mobile app. The auth server trusts it as an origin and
 * the app registers it, so it must equal `expo.scheme` in mobile/app.json.
 * `scripts/rename-app.sh` rewrites both together.
 */
export const APP_SCHEME = "typescript-template";
