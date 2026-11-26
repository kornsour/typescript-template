import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useColors } from "../theme";

export function Loading({ label = "Loading" }: { label?: string }) {
	const colors = useColors();
	return (
		<View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel={label}
			style={[styles.center, { backgroundColor: colors.background }]}
		>
			<ActivityIndicator size="large" color={colors.text} />
		</View>
	);
}

const styles = StyleSheet.create({
	center: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
});
