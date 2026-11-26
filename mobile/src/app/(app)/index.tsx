import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/button";
import { Loading } from "../../components/loading";
import { Message } from "../../components/message";
import { Screen } from "../../components/screen";
import { api } from "../../lib/api";
import { authClient } from "../../lib/auth-client";
import { useApi } from "../../lib/use-api";
import { fontSize, radius, spacing, useColors } from "../../theme";

export default function HomeScreen() {
	const colors = useColors();
	const { refetch: refetchSession } = authClient.useSession();
	const { state, reload } = useApi(api.me);
	const [signingOut, setSigningOut] = useState(false);

	// A 401 means the server no longer accepts this session. Re-checking it lets
	// the root layout redirect to sign-in.
	const unauthorized = state.status === "error" && state.error.status === 401;
	useEffect(() => {
		if (unauthorized) refetchSession();
	}, [unauthorized, refetchSession]);

	// The auth client forgets the session on the device before calling the
	// server, so this screen is gone whether or not that call succeeds. If it
	// fails, the server-side session lasts until it expires.
	async function signOut() {
		setSigningOut(true);
		try {
			await authClient.signOut();
		} catch {
			// Already signed out on this device; there is nothing left to show.
		} finally {
			setSigningOut(false);
		}
	}

	return (
		<Screen title="Home">
			{state.status === "loading" ? <Loading label="Loading your account" /> : null}
			{state.status === "error" ? (
				<>
					<Message tone="error" text={state.error.message} />
					<Button variant="secondary" label="Try again" onPress={reload} />
				</>
			) : null}
			{state.status === "success" ? (
				<View style={[styles.card, { backgroundColor: colors.surface }]}>
					<Text style={[styles.name, { color: colors.text }]}>
						Signed in as {state.data.user.name}
					</Text>
					<Text style={[styles.detail, { color: colors.mutedText }]}>{state.data.user.email}</Text>
					<Text style={[styles.detail, { color: colors.mutedText }]}>
						{state.data.user.emailVerified ? "Email verified" : "Email not verified"}
					</Text>
				</View>
			) : null}
			<Button variant="secondary" label="Sign out" loading={signingOut} onPress={signOut} />
		</Screen>
	);
}

const styles = StyleSheet.create({
	card: { gap: spacing.xs, padding: spacing.md, borderRadius: radius },
	name: { fontSize: fontSize.md, fontWeight: "600" },
	detail: { fontSize: fontSize.sm },
});
