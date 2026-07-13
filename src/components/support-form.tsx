"use client";

import {
	Button,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from "@kornorg/design-system";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { submitSupportRequest } from "@/lib/support/actions";
import { SUPPORT_CATEGORIES } from "@/lib/support/schema";

/**
 * Support / "report a bug" form. Public — usable signed in or out. Name and
 * email prefill from the session when available. Submits to a server action
 * that emails the app's support inbox with the sender as reply-to.
 */
export function SupportForm({
	defaultName = "",
	defaultEmail = "",
}: {
	defaultName?: string;
	defaultEmail?: string;
}) {
	const [name, setName] = useState(defaultName);
	const [email, setEmail] = useState(defaultEmail);
	const [category, setCategory] = useState<(typeof SUPPORT_CATEGORIES)[number]>("Bug");
	const [message, setMessage] = useState("");

	const { execute, isPending, result } = useAction(submitSupportRequest);
	const sent = result.data?.ok === true;

	// Surface the first field/validation message or a server error, if any.
	const ve = result.validationErrors;
	const errorMessage =
		result.serverError ??
		ve?.name?._errors?.[0] ??
		ve?.email?._errors?.[0] ??
		ve?.message?._errors?.[0] ??
		ve?.category?._errors?.[0] ??
		null;

	if (sent) {
		return (
			<div className="flex flex-col gap-4">
				<h1 className="text-xl font-semibold tracking-tight">Thanks — we got it</h1>
				<p className="text-sm text-muted-foreground">
					Your message is on its way to our support team. We'll reply to {email}.
				</p>
			</div>
		);
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				execute({ name, email, category, message });
			}}
			className="flex flex-col gap-4"
		>
			<div>
				<h1 className="text-xl font-semibold tracking-tight">Contact support</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Found a bug or need a hand? Send us a message and we'll get back to you.
				</p>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="support-name">Name</Label>
				<Input
					id="support-name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					autoComplete="name"
					required
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="support-email">Email</Label>
				<Input
					id="support-email"
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					autoComplete="email"
					placeholder="you@example.com"
					required
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="support-category">Category</Label>
				<Select
					value={category}
					onValueChange={(v) => setCategory(v as (typeof SUPPORT_CATEGORIES)[number])}
				>
					<SelectTrigger id="support-category">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{SUPPORT_CATEGORIES.map((c) => (
							<SelectItem key={c} value={c}>
								{c}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="support-message">Message</Label>
				<Textarea
					id="support-message"
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					rows={6}
					placeholder="What happened, and what did you expect?"
					required
					minLength={10}
				/>
			</div>
			{errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
			<Button type="submit" disabled={isPending}>
				{isPending ? "Sending…" : "Send message"}
			</Button>
		</form>
	);
}
