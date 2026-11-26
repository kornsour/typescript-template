import { MIN_PASSWORD_LENGTH, passwordScore, STRENGTH_LABELS } from "@app/shared/password";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Button } from "../../components/button";
import { Checkbox } from "../../components/checkbox";
import { Message } from "../../components/message";
import { Screen } from "../../components/screen";
import { TextField } from "../../components/text-field";
import { VerifyEmailNotice } from "../../components/verify-email-notice";
import { authClient } from "../../lib/auth-client";
import { authErrorMessage, NETWORK_ERROR_MESSAGE } from "../../lib/auth-errors";
import { API_URL } from "../../lib/config";
import { type FieldErrors, type SignUpValues, validateSignUp } from "../../lib/forms";

const EMPTY: SignUpValues = {
	name: "",
	email: "",
	password: "",
	confirmPassword: "",
	acceptedTerms: false,
};

export default function SignUpScreen() {
	const router = useRouter();
	const { error: sessionError } = authClient.useSession();
	const [values, setValues] = useState(EMPTY);
	const [errors, setErrors] = useState<FieldErrors<SignUpValues>>({});
	const [formError, setFormError] = useState<string | null>(null);
	/** Set once the account exists but needs email verification before sign-in. */
	const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	function set<K extends keyof SignUpValues>(field: K, value: SignUpValues[K]) {
		setValues((current) => ({ ...current, [field]: value }));
		setErrors((current) => ({ ...current, [field]: undefined }));
	}

	async function openWebPage(path: "/terms" | "/privacy") {
		try {
			await WebBrowser.openBrowserAsync(`${API_URL}${path}`);
		} catch {
			setFormError(`Couldn't open ${API_URL}${path}.`);
		}
	}

	async function submit() {
		if (pending) return;
		setFormError(null);
		const result = validateSignUp(values);
		if (!result.ok) {
			setErrors(result.errors);
			return;
		}
		setPending(true);
		try {
			// No `callbackURL`, so the emailed verification link lands on the web
			// app and works from any device.
			const { data, error } = await authClient.signUp.email(result.data);
			if (error) {
				setFormError(authErrorMessage(error));
				return;
			}
			// With a session token the root layout switches to the app by itself.
			if (!data?.token) setVerifyEmail(result.data.email);
		} catch {
			setFormError(NETWORK_ERROR_MESSAGE);
		} finally {
			setPending(false);
		}
	}

	if (verifyEmail) {
		return (
			<Screen title="Check your email">
				<VerifyEmailNotice
					email={verifyEmail}
					message={`If ${verifyEmail} can be registered, we've sent it a verification link. Open the link, then come back and sign in.`}
				/>
				<Button label="Go to sign in" onPress={() => router.replace("/sign-in")} />
			</Screen>
		);
	}

	const strength = values.password
		? `${STRENGTH_LABELS[passwordScore(values.password)]} · at least ${MIN_PASSWORD_LENGTH} characters`
		: `At least ${MIN_PASSWORD_LENGTH} characters`;

	return (
		<Screen title="Create account">
			<TextField
				label="Name"
				value={values.name}
				onChangeText={(text) => set("name", text)}
				error={errors.name}
				autoComplete="name"
				textContentType="name"
				editable={!pending}
			/>
			<TextField
				label="Email"
				value={values.email}
				onChangeText={(text) => set("email", text)}
				error={errors.email}
				keyboardType="email-address"
				autoCapitalize="none"
				autoCorrect={false}
				autoComplete="email"
				textContentType="emailAddress"
				editable={!pending}
			/>
			<TextField
				label="Password"
				value={values.password}
				onChangeText={(text) => set("password", text)}
				error={errors.password}
				hint={strength}
				secureTextEntry
				autoCapitalize="none"
				autoComplete="new-password"
				textContentType="newPassword"
				editable={!pending}
			/>
			<TextField
				label="Confirm password"
				value={values.confirmPassword}
				onChangeText={(text) => set("confirmPassword", text)}
				error={
					errors.confirmPassword ??
					(values.confirmPassword && values.password !== values.confirmPassword
						? "Passwords don't match."
						: undefined)
				}
				secureTextEntry
				autoCapitalize="none"
				autoComplete="new-password"
				textContentType="newPassword"
				returnKeyType="go"
				onSubmitEditing={submit}
				editable={!pending}
			/>
			<Checkbox
				label="I agree to the Terms of Service and Privacy Policy."
				checked={values.acceptedTerms}
				onChange={(checked) => set("acceptedTerms", checked)}
				disabled={pending}
			/>
			{errors.acceptedTerms ? <Message tone="error" text={errors.acceptedTerms} /> : null}
			<Button
				variant="link"
				accessibilityRole="link"
				label="Read the Terms of Service"
				onPress={() => openWebPage("/terms")}
			/>
			<Button
				variant="link"
				accessibilityRole="link"
				label="Read the Privacy Policy"
				onPress={() => openWebPage("/privacy")}
			/>
			{formError ? <Message tone="error" text={formError} /> : null}
			{!formError && sessionError && !sessionError.status ? (
				// The account may exist already if only the session check failed.
				<Message
					tone="error"
					text={`Couldn't reach the server at ${API_URL}. If you just signed up, try signing in.`}
				/>
			) : null}
			<Button label="Create account" loading={pending} onPress={submit} />
			<Button
				variant="link"
				accessibilityRole="link"
				label="Already have an account? Sign in"
				disabled={pending}
				onPress={() => router.replace("/sign-in")}
			/>
		</Screen>
	);
}
