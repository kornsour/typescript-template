import { APP_SCHEME } from "@app/shared/app";
import { expoClient } from "@better-auth/expo/client";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { REQUEST_TIMEOUT_MS } from "./api-client";
import { API_URL } from "./config";
import { toStoragePrefix } from "./storage-prefix";
import { timeoutFetch } from "./timeout-fetch";

export const authClient = createAuthClient({
	baseURL: API_URL,
	fetchOptions: { customFetchImpl: timeoutFetch(REQUEST_TIMEOUT_MS) },
	plugins: [
		// Keeps the session cookie in the device keychain/keystore and sends it,
		// plus the app's origin, with every auth request.
		expoClient({
			scheme: APP_SCHEME,
			storagePrefix: toStoragePrefix(APP_SCHEME),
			storage: SecureStore,
		}),
		// Mirrors `user.additionalFields` in the web app's src/lib/auth.ts. Spelled
		// out here because the mobile app must not import server code.
		inferAdditionalFields({
			user: {
				legalAcceptedVersion: { type: "string", required: false },
				legalAcceptedAt: { type: "date", required: false },
			},
		}),
	],
});
