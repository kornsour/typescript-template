import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_VERSION, legalConfig } from "@/content/legal/config";

export const metadata: Metadata = { title: "Acceptable Use Policy" };

export default function AcceptableUsePage() {
	const c = legalConfig;
	return (
		<>
			<h1>Acceptable Use Policy</h1>
			<p>
				Version {LEGAL_VERSION} · Effective {c.effectiveDate} · Last updated {c.lastUpdated}
			</p>
			<p>
				This policy is part of our <Link href="/terms">Terms of Service</Link>. Violating it can
				result in content removal, suspension, or termination of your account.
			</p>

			<h2>1. General prohibited conduct</h2>
			<p>You may not use the Service to:</p>
			<ul>
				<li>Violate any applicable law or regulation.</li>
				<li>Infringe anyone's intellectual property, privacy, or other rights.</li>
				<li>
					Transmit malware, or attempt to gain unauthorized access to the Service or other users'
					accounts.
				</li>
				<li>
					Scrape, crawl, or bulk-extract data from the Service except through an API we explicitly
					provide for that purpose.
				</li>
				<li>
					Reverse-engineer, decompile, or attempt to derive the source code of the Service, except
					as permitted by law.
				</li>
				<li>
					Interfere with or disrupt the integrity or performance of the Service (e.g.
					denial-of-service, excessive automated requests outside documented rate limits).
				</li>
				<li>
					Resell or provide the Service to third parties as your own, except as your plan explicitly
					permits.
				</li>
			</ul>

			<h2>2. Content you submit</h2>
			<p>
				You may not submit or generate content, through any feature including AI features, that:
			</p>
			<ul>
				<li>Is illegal, fraudulent, or deceptive.</li>
				<li>Is defamatory, harassing, hateful, or threatens violence against a person or group.</li>
				<li>Sexually exploits or endangers minors in any way.</li>
				<li>
					Infringes someone else's intellectual property or violates their privacy or publicity
					rights.
				</li>
				<li>
					Impersonates a person or organization in a misleading way, including AI-generated
					deepfakes of real people without consent.
				</li>
			</ul>

			<h2>3. AI feature misuse</h2>
			<p>
				If the Service includes AI features (see <Link href="/ai-disclosure">AI Disclosure</Link>
				), you additionally may not:
			</p>
			<ul>
				<li>
					Attempt to bypass, "jailbreak," or manipulate the AI feature's safety controls or usage
					limits.
				</li>
				<li>
					Use the AI feature to generate content prohibited under Section 2, or to build a competing
					AI product by systematically extracting its outputs.
				</li>
				<li>
					Present AI-generated output as human-generated where that would deceive a reasonable
					person, except as our documented product features (e.g. drafting assistance) intend.
				</li>
				<li>
					Rely on AI output for a "consequential decision" about a person — e.g. employment,
					lending, housing, insurance, healthcare, or education — unless you've confirmed with
					counsel that your specific use complies with applicable AI-specific law (see{" "}
					<code>docs/legal.md</code>) and have added the human-review/appeal process those laws
					require.
				</li>
			</ul>

			<h2>4. Reporting violations</h2>
			<p>To report a suspected violation of this policy, contact {c.contactEmail}.</p>
		</>
	);
}
