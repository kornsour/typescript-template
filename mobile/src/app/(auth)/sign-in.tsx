import { useRouter } from "expo-router";
import { useState } from "react";
import { Button } from "../../components/button";
import { Message } from "../../components/message";
import { Screen } from "../../components/screen";
import { TextField } from "../../components/text-field";
import { VerifyEmailNotice } from "../../components/verify-email-notice";
import { authClient } from "../../lib/auth-client";
import { authErrorMessage, isEmailNotVerified, NETWORK_ERROR_MESSAGE } from "../../lib/auth-errors";
import { API_URL } from "../../lib/config";
import { type FieldErrors, type SignInValues, validateSignIn } from "../../lib/forms";

export default function SignInScreen() {
	const router = useRouter();
	const { error: sessionError } = authClient.useSession();
	const [values, setValues] = useState<SignInValues>({ email: "", password: "" });
	const [errors, setErrors] = useState<FieldErrors<SignInValues>>({});
	const [formError, setFormError] = useState<string | null>(null);
	const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	function set(field: keyof SignInValues, value: string) {
		setValues((current) => ({ ...current, [field]: value }));
		setErrors((current) => ({ ...current, [field]: undefined }));
	}

	async function submit() {
		if (pending) return;
		setFormError(null);
		setUnverifiedEmail(null);
		const result = validateSignIn(values);
		if (!result.ok) {
			setErrors(result.errors);
			return;
		}
		setPending(true);
		try {
			// No `callbackURL`: on native it makes the auth client open a browser.
			// On success the session updates and the root layout shows the app.
			const { error } = await authClient.signIn.email(result.data);
			if (!error) return;
			if (isEmailNotVerified(error)) setUnverifiedEmail(result.data.email);
			else setFormError(authErrorMessage(error));
		} catch {
			setFormError(NETWORK_ERROR_MESSAGE);
		} finally {
			setPending(false);
		}
	}

	return (
		<Screen title="Sign in">
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
				secureTextEntry
				autoCapitalize="none"
				autoComplete="current-password"
				textContentType="password"
				returnKeyType="go"
				onSubmitEditing={submit}
				editable={!pending}
			/>
			{formError ? <Message tone="error" text={formError} /> : null}
			{!formError && sessionError && !sessionError.status ? (
				<Message tone="error" text={`Couldn't reach the server at ${API_URL}.`} />
			) : null}
			{unverifiedEmail ? (
				<VerifyEmailNotice
					email={unverifiedEmail}
					message="Your email isn't verified yet. We've sent a new verification link to your inbox. Open it, then sign in again."
				/>
			) : null}
			<Button label="Sign in" loading={pending} onPress={submit} />
			<Button
				variant="link"
				accessibilityRole="link"
				label="Need an account? Sign up"
				disabled={pending}
				onPress={() => router.replace("/sign-up")}
			/>
		</Screen>
	);
}
