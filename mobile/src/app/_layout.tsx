import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Loading } from "../components/loading";
import { authClient } from "../lib/auth-client";
import { useColors } from "../theme";

export default function RootLayout() {
	const colors = useColors();
	const { data: session, isPending } = authClient.useSession();

	// Only the first session check blocks the UI. Later refetches also report
	// `isPending` while signed out, and swapping the navigator out then would
	// throw away form state.
	const [ready, setReady] = useState(false);
	useEffect(() => {
		if (!isPending) setReady(true);
	}, [isPending]);

	if (!ready) return <Loading label="Checking your session" />;

	const signedIn = Boolean(session);
	return (
		<>
			<StatusBar style="auto" />
			<Stack
				screenOptions={{
					headerShown: false,
					contentStyle: { backgroundColor: colors.background },
				}}
			>
				{/* Client-side routing only: the server authorizes every API request. */}
				<Stack.Protected guard={signedIn}>
					<Stack.Screen name="(app)" />
				</Stack.Protected>
				<Stack.Protected guard={!signedIn}>
					<Stack.Screen name="(auth)" />
				</Stack.Protected>
			</Stack>
		</>
	);
}
