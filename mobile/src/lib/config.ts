import Constants from "expo-constants";
import { Platform } from "react-native";
import { resolveApiUrl } from "./api-url";

/**
 * Origin of the web app (API, auth, and the legal pages). Resolved at startup so
 * a misconfigured production build fails immediately.
 */
export const API_URL = resolveApiUrl({
	// Must stay a literal `process.env.EXPO_PUBLIC_*` access so Metro can inline it.
	envUrl: process.env.EXPO_PUBLIC_API_URL,
	hostUri: Constants.expoConfig?.hostUri,
	isDev: __DEV__,
	platform: Platform.OS,
});
