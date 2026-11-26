import { useColorScheme } from "react-native";

const light = {
	background: "#ffffff",
	surface: "#f4f4f5",
	text: "#18181b",
	mutedText: "#52525b",
	border: "#8b8b94",
	primary: "#18181b",
	onPrimary: "#fafafa",
	danger: "#b91c1c",
};

export type Colors = typeof light;

const dark: Colors = {
	background: "#09090b",
	surface: "#18181b",
	text: "#fafafa",
	mutedText: "#a1a1aa",
	border: "#6b6b74",
	primary: "#fafafa",
	onPrimary: "#18181b",
	danger: "#f87171",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = 8;
export const fontSize = { sm: 14, md: 16, lg: 28 } as const;
/** Minimum height of anything tappable. */
export const touchTarget = 48;

export function useColors(): Colors {
	return useColorScheme() === "dark" ? dark : light;
}
