import { Stack } from "expo-router";
import { useColors } from "../../theme";

/** Every route in this group requires a session (see the root layout). */
export default function AppLayout() {
	const colors = useColors();
	return (
		<Stack
			screenOptions={{
				headerStyle: { backgroundColor: colors.background },
				headerTintColor: colors.text,
				contentStyle: { backgroundColor: colors.background },
			}}
		>
			<Stack.Screen name="index" options={{ headerShown: false, title: "Home" }} />
		</Stack>
	);
}
