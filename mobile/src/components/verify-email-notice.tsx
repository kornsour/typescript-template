import { useState } from "react";
import { authClient } from "../lib/auth-client";
import { authErrorMessage, NETWORK_ERROR_MESSAGE } from "../lib/auth-errors";
import { Button } from "./button";
import { Message } from "./message";

/** "Check your email" text with a button to send the verification link again. */
export function VerifyEmailNotice({ email, message }: { email: string; message: string }) {
	const [pending, setPending] = useState(false);
	const [status, setStatus] = useState<{ tone: "info" | "error"; text: string } | null>(null);

	async function resend() {
		setPending(true);
		setStatus(null);
		try {
			const { error } = await authClient.sendVerificationEmail({ email });
			setStatus(
				error
					? { tone: "error", text: authErrorMessage(error) }
					: { tone: "info", text: "Verification email sent." },
			);
		} catch {
			setStatus({ tone: "error", text: NETWORK_ERROR_MESSAGE });
		} finally {
			setPending(false);
		}
	}

	return (
		<>
			<Message text={message} />
			{status ? <Message tone={status.tone} text={status.text} /> : null}
			<Button
				variant="secondary"
				label="Resend verification email"
				loading={pending}
				onPress={resend}
			/>
		</>
	);
}
