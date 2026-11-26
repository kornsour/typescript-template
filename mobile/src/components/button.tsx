import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { fontSize, radius, spacing, touchTarget, useColors } from "../theme";

interface ButtonProps {
	label: string;
	onPress: () => void;
	variant?: "primary" | "secondary" | "link";
	/** Shows a spinner and blocks presses. */
	loading?: boolean;
	disabled?: boolean;
	accessibilityRole?: "button" | "link";
}

export function Button({
	label,
	onPress,
	variant = "primary",
	loading = false,
	disabled = false,
	accessibilityRole = "button",
}: ButtonProps) {
	const colors = useColors();
	const inactive = disabled || loading;
	const textColor = variant === "primary" ? colors.onPrimary : colors.text;

	return (
		<Pressable
			accessibilityRole={accessibilityRole}
			accessibilityLabel={label}
			accessibilityState={{ disabled: inactive, busy: loading }}
			disabled={inactive}
			onPress={onPress}
			style={({ pressed }) => [
				styles.base,
				variant === "primary" && { backgroundColor: colors.primary },
				variant === "secondary" && { borderWidth: 1, borderColor: colors.border },
				{ opacity: inactive || pressed ? 0.6 : 1 },
			]}
		>
			{loading ? (
				<ActivityIndicator color={textColor} />
			) : (
				<Text style={[styles.label, { color: textColor }, variant === "link" && styles.link]}>
					{label}
				</Text>
			)}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	base: {
		minHeight: touchTarget,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radius,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	label: { fontSize: fontSize.md, fontWeight: "600", textAlign: "center" },
	link: { textDecorationLine: "underline", fontWeight: "500" },
});
