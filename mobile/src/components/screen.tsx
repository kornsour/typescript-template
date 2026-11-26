import type { ReactNode } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fontSize, spacing, useColors } from "../theme";

/** Page frame: safe area, scrolling, keyboard avoidance and a title. */
export function Screen({ title, children }: { title: string; children: ReactNode }) {
	const colors = useColors();
	return (
		<SafeAreaView style={[styles.fill, { backgroundColor: colors.background }]}>
			<KeyboardAvoidingView style={styles.fill} behavior="padding">
				<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
					<Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
						{title}
					</Text>
					{children}
				</ScrollView>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	fill: { flex: 1 },
	content: {
		flexGrow: 1,
		justifyContent: "center",
		gap: spacing.md,
		padding: spacing.lg,
		width: "100%",
		maxWidth: 480,
		alignSelf: "center",
	},
	title: { fontSize: fontSize.lg, fontWeight: "700" },
});
