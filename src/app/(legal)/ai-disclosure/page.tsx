import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_VERSION, legalConfig } from "@/content/legal/config";

export const metadata: Metadata = { title: "AI Disclosure" };

export default function AiDisclosurePage() {
	const c = legalConfig;
	const providerList =
		c.aiSubprocessors.length > 0 ? c.aiSubprocessors.join(", ") : "none currently";

	return (
		<>
			<h1>AI Disclosure &amp; Transparency</h1>
			<p>
				Version {LEGAL_VERSION} · Effective {c.effectiveDate} · Last updated {c.lastUpdated}
			</p>

			<h2>1. You are interacting with AI</h2>
			<p>
				Some features of this Service use artificial intelligence — including generative AI — to
				produce responses, content, or recommendations. Where such a feature responds to you
				directly (e.g. a chat interface),{" "}
				<strong>you are interacting with an automated system, not a human</strong>, unless the
				interface explicitly says a human is involved. This disclosure is provided consistent with
				AI chatbot-disclosure laws (e.g. California's Bot Disclosure Law, Cal. Bus. &amp; Prof. Code
				§17941) and the EU AI Act's transparency obligations for systems that interact with natural
				persons (Article 50).
			</p>

			<h2>2. What AI features do here</h2>
			<p>
				This application does not currently provide user-facing AI features in production. If and
				when AI features are enabled, this page will be updated with feature-specific details before
				or at launch of those features.
			</p>

			<h2>3. Who processes your input</h2>
			<p>
				When you use an AI feature, the text (and any other content) you submit to it is sent to the
				following third-party AI provider(s) for processing: {providerList}. See our{" "}
				<Link href="/privacy">Privacy Policy</Link> for how we handle that data more generally, and
				each provider's own privacy/data-use terms for how they handle it on their side (in
				particular, whether your input is used to train their models — confirm this with your
				provider agreement and disclose it here).
			</p>

			<h2>4. Limitations — please read</h2>
			<ul>
				<li>
					AI output can be <strong>inaccurate, incomplete, outdated, or biased</strong>. It reflects
					patterns in training data, not verified facts.
				</li>
				<li>
					AI output is <strong>not professional advice</strong> — not legal, medical, financial,
					tax, or safety advice — even if it's phrased confidently or in a professional tone.
				</li>
				<li>
					You're responsible for independently verifying anything you rely on before acting on it.
				</li>
				<li>
					AI-generated content may unintentionally resemble existing copyrighted or trademarked
					material; we don't guarantee it's free to use for every purpose.
				</li>
			</ul>

			<h2>5. High-risk &amp; consequential uses</h2>
			<p>
				This Service's default AI disclosure and safeguards are <strong>not sufficient</strong> if
				you use (or let your customers use) an AI feature to make or materially inform a decision
				about a specific person in an area such as employment, credit/lending, housing, insurance,
				healthcare, or education. Depending on your jurisdiction and use case, that can trigger
				additional obligations, for example:
			</p>
			<ul>
				<li>
					The Colorado AI Act (SB 24-205) — impact assessments, consumer notice, and an opportunity
					to correct/appeal for "high-risk" AI systems used in consequential decisions.
				</li>
				<li>
					NYC Local Law 144 — bias audits and candidate notice for automated employment-decision
					tools used by NYC employers.
				</li>
				<li>
					The EU AI Act (Regulation (EU) 2024/1689) — Annex III "high-risk" obligations (risk
					management, human oversight, logging) if the system is offered to users in the EU.
				</li>
				<li>
					Illinois, and a growing list of other states, regulate AI use in specific contexts like
					employment interviews and insurance underwriting.
				</li>
			</ul>
			<p>
				If you plan to use AI for consequential decisions, do not rely on this baseline disclosure
				alone; implement feature-specific controls, human review, and any required assessments
				before deployment.
			</p>

			<h2>6. Synthetic content</h2>
			<p>
				This service does not currently generate synthetic images, audio, or video for users. If
				that changes, we will update this disclosure and add any required in-product labeling.
			</p>

			<h2>7. Your choices</h2>
			<p>
				Because no user-facing AI features are currently enabled, there are no AI-specific controls
				to manage at this time. If AI features are enabled in the future, this section will describe
				your available controls.
			</p>

			<h2>8. Contact</h2>
			<p>Questions about our use of AI: {c.contactEmail}.</p>
		</>
	);
}
