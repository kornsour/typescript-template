import { signUpSchema } from "@app/shared/auth";
import { LEGAL_VERSION } from "@app/shared/legal";
import { passwordError } from "@app/shared/password";

export interface SignInValues {
	email: string;
	password: string;
}

export interface SignUpValues {
	name: string;
	email: string;
	password: string;
	confirmPassword: string;
	acceptedTerms: boolean;
}

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export type Validation<T, D> = { ok: true; data: D } | { ok: false; errors: FieldErrors<T> };

const INVALID_EMAIL = "Enter a valid email address.";

export function validateSignIn(values: SignInValues): Validation<SignInValues, SignInValues> {
	const email = values.email.trim();
	const errors: FieldErrors<SignInValues> = {};
	if (!signUpSchema.shape.email.safeParse(email).success) errors.email = INVALID_EMAIL;
	// No password policy on sign-in: the server decides whether it is correct.
	if (!values.password) errors.password = "Enter your password.";
	if (errors.email || errors.password) return { ok: false, errors };
	return { ok: true, data: { email, password: values.password } };
}

/** The body for `authClient.signUp.email`, mirroring the web sign-up form. */
export interface SignUpRequest {
	name: string;
	email: string;
	password: string;
	legalAcceptedVersion: string;
	legalAcceptedAt: Date;
}

export function validateSignUp(
	values: SignUpValues,
	now: Date = new Date(),
): Validation<SignUpValues, SignUpRequest> {
	const email = values.email.trim();
	const errors: FieldErrors<SignUpValues> = {};

	// Field by field, so one bad field never hides another's message.
	const name = signUpSchema.shape.name.safeParse(values.name);
	if (!name.success) errors.name = name.error.issues[0]?.message;
	if (!signUpSchema.shape.email.safeParse(email).success) errors.email = INVALID_EMAIL;
	const password = passwordError(values.password);
	if (password) errors.password = password;
	if (values.password !== values.confirmPassword) {
		errors.confirmPassword = "Passwords don't match.";
	}
	if (!values.acceptedTerms) {
		errors.acceptedTerms = "You must agree to the Terms of Service and Privacy Policy.";
	}
	if (Object.keys(errors).length > 0) return { ok: false, errors };

	// The shared schema has the final say, in case it gains rules this form lacks.
	const parsed = signUpSchema.safeParse({ ...values, email });
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		const field = (issue?.path[0] ?? "name") as keyof SignUpValues;
		return { ok: false, errors: { [field]: issue?.message } };
	}

	return {
		ok: true,
		data: {
			name: parsed.data.name,
			email: parsed.data.email,
			password: parsed.data.password,
			legalAcceptedVersion: LEGAL_VERSION,
			legalAcceptedAt: now,
		},
	};
}
