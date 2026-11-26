import { Pressable, StyleSheet, Text, View } from "react-native";
import { fontSize, spacing, touchTarget, useColors } from "../theme";

interface CheckboxProps {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
}

export function Checkbox({ label, checked, onChange, disabled = false }: CheckboxProps) {
	const colors = useColors();
	return (
		<Pressable
			accessibilityRole="checkbox"
			accessibilityLabel={label}
			accessibilityState={{ checked, disabled }}
			disabled={disabled}
			onPress={() => onChange(!checked)}
			style={styles.row}
		>
			<View
				style={[
					styles.box,
					{ borderColor: colors.border },
					checked && { backgroundColor: colors.primary, borderColor: colors.primary },
				]}
			>
				{checked ? <Text style={[styles.mark, { color: colors.onPrimary }]}>✓</Text> : null}
			</View>
			<Text style={[styles.label, { color: colors.text }]}>{label}</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: touchTarget },
	box: {
		width: 24,
		height: 24,
		borderWidth: 2,
		borderRadius: 4,
		alignItems: "center",
		justifyContent: "center",
	},
	mark: { fontSize: fontSize.md, fontWeight: "700", lineHeight: 20 },
	label: { flex: 1, fontSize: fontSize.sm },
});
