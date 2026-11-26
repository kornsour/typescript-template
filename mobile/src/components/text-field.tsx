import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { fontSize, radius, spacing, touchTarget, useColors } from "../theme";

interface TextFieldProps extends Omit<TextInputProps, "style"> {
	label: string;
	error?: string | undefined;
	/** Guidance shown under the field when there is no error. */
	hint?: string | undefined;
}

export function TextField({ label, error, hint, ...input }: TextFieldProps) {
	const colors = useColors();
	const message = error ?? hint;

	return (
		<View style={styles.field}>
			{/* The input carries the label, so screen readers don't announce it twice. */}
			<Text
				accessibilityElementsHidden
				importantForAccessibility="no"
				style={[styles.label, { color: colors.text }]}
			>
				{label}
			</Text>
			<TextInput
				accessibilityLabel={label}
				accessibilityHint={message}
				placeholderTextColor={colors.mutedText}
				{...input}
				style={[
					styles.input,
					{
						color: colors.text,
						backgroundColor: colors.surface,
						borderColor: error ? colors.danger : colors.border,
					},
				]}
			/>
			{message ? (
				<Text
					accessibilityLiveRegion={error ? "polite" : "none"}
					style={[styles.message, { color: error ? colors.danger : colors.mutedText }]}
				>
					{message}
				</Text>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	field: { gap: spacing.xs },
	label: { fontSize: fontSize.sm, fontWeight: "600" },
	input: {
		minHeight: touchTarget,
		borderWidth: 1,
		borderRadius: radius,
		paddingHorizontal: spacing.md,
		fontSize: fontSize.md,
	},
	message: { fontSize: fontSize.sm },
});
