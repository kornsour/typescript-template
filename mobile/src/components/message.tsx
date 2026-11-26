import { StyleSheet, Text } from "react-native";
import { fontSize, useColors } from "../theme";

/** Inline status text. Errors are announced to screen readers. */
export function Message({ text, tone = "info" }: { text: string; tone?: "info" | "error" }) {
	const colors = useColors();
	const isError = tone === "error";
	return (
		<Text
			accessibilityRole={isError ? "alert" : "text"}
			accessibilityLiveRegion="polite"
			style={[styles.text, { color: isError ? colors.danger : colors.mutedText }]}
		>
			{text}
		</Text>
	);
}

const styles = StyleSheet.create({
	text: { fontSize: fontSize.md, lineHeight: 22 },
});
