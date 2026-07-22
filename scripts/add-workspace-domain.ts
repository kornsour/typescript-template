/**
 * Verifies ownership of, and adds, a new domain to the Google Workspace
 * account — a prerequisite for creating groups (e.g. support@) under that
 * domain. Uses the same key-free Workload Identity Federation + domain-wide
 * delegation flow as create-support-group.ts, just with different scopes.
 *
 * Flow (see docs.cloud.google.com/channel/docs/codelabs/workspace/domain-verification):
 *   1. siteVerification.webResource.getToken  -> DNS TXT record value
 *   2. (operator adds the TXT record via Route53, waits for propagation)
 *   3. siteVerification.webResource.insert    -> verifies ownership
 *   4. directory.domains.insert               -> adds it as a Workspace domain
 *
 * Steps 1 and 4 are combined into this script's two subcommands so the
 * TXT record can be created and left to propagate between them:
 *
 *   node scripts/add-workspace-domain.ts get-token   <domain> <admin-email>
 *   node scripts/add-workspace-domain.ts verify-add   <domain> <admin-email>
 */
import { GoogleAuth } from "google-auth-library";

const SITE_VERIFICATION_SCOPE = "https://www.googleapis.com/auth/siteverification";
const DIRECTORY_DOMAIN_SCOPE = "https://www.googleapis.com/auth/admin.directory.domain";

async function getDelegatedAccessToken(serviceAccountEmail: string, subjectEmail: string, scope: string) {
	const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/iam"] });
	const client = await auth.getClient();

	const now = Math.floor(Date.now() / 1000);
	const claims = {
		iss: serviceAccountEmail,
		sub: subjectEmail,
		scope,
		aud: "https://oauth2.googleapis.com/token",
		iat: now,
		exp: now + 3600,
	};

	const signRes = await client.request<{ signedJwt: string }>({
		url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:signJwt`,
		method: "POST",
		data: { payload: JSON.stringify(claims) },
	});

	const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
			assertion: signRes.data.signedJwt,
		}),
	});

	const tokenJson = (await tokenRes.json()) as {
		access_token?: string;
		error?: string;
		error_description?: string;
	};
	if (!tokenRes.ok || !tokenJson.access_token) {
		throw new Error(`Token exchange failed: ${tokenJson.error} ${tokenJson.error_description ?? ""}`);
	}
	return tokenJson.access_token;
}

async function getVerificationToken(accessToken: string, domain: string) {
	const res = await fetch("https://www.googleapis.com/siteVerification/v1/token", {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify({
			site: { type: "INET_DOMAIN", identifier: domain },
			verificationMethod: "DNS",
		}),
	});
	if (!res.ok) throw new Error(`getToken failed: ${res.status} ${await res.text()}`);
	const json = (await res.json()) as { token: string };
	return json.token;
}

async function verifyDomain(accessToken: string, domain: string, ownerEmail: string) {
	const res = await fetch(
		"https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=DNS",
		{
			method: "POST",
			headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
			body: JSON.stringify({
				site: { type: "INET_DOMAIN", identifier: domain },
				owners: [ownerEmail],
			}),
		},
	);
	if (!res.ok) throw new Error(`webResource.insert failed: ${res.status} ${await res.text()}`);
}

async function addWorkspaceDomain(accessToken: string, domain: string) {
	const res = await fetch("https://admin.googleapis.com/admin/directory/v1/customer/my_customer/domains", {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify({ domainName: domain }),
	});
	if (res.status === 409) {
		console.log(`${domain} is already added to this Workspace account — skipping.`);
		return;
	}
	if (!res.ok) throw new Error(`domains.insert failed: ${res.status} ${await res.text()}`);
	console.log(`Added ${domain} to the Workspace account: ${await res.text()}`);
}

async function getWorkspaceDomain(accessToken: string, domain: string) {
	const res = await fetch(
		`https://admin.googleapis.com/admin/directory/v1/customer/my_customer/domains/${domain}`,
		{ headers: { Authorization: `Bearer ${accessToken}` } },
	);
	if (!res.ok) throw new Error(`domains.get failed: ${res.status} ${await res.text()}`);
	console.log(await res.text());
}

async function main() {
	const [command, domain, adminEmail] = process.argv.slice(2);
	const serviceAccountEmail = process.env.WORKSPACE_SA_EMAIL;
	if (!serviceAccountEmail) throw new Error("Missing required env var: WORKSPACE_SA_EMAIL");

	const validCommands = ["get-token", "verify-add", "add-only", "status"];
	if (!command || !domain || !adminEmail || !validCommands.includes(command)) {
		console.error(`Usage: node scripts/add-workspace-domain.ts <${validCommands.join("|")}> <domain> <admin-email>`);
		process.exit(1);
	}

	if (command === "get-token") {
		const accessToken = await getDelegatedAccessToken(serviceAccountEmail, adminEmail, SITE_VERIFICATION_SCOPE);
		const token = await getVerificationToken(accessToken, domain);
		console.log(`Add this TXT record at the apex of ${domain}:\n\n  ${token}\n`);
		return;
	}

	if (command === "add-only") {
		const directoryToken = await getDelegatedAccessToken(serviceAccountEmail, adminEmail, DIRECTORY_DOMAIN_SCOPE);
		await addWorkspaceDomain(directoryToken, domain);
		return;
	}

	if (command === "status") {
		const directoryToken = await getDelegatedAccessToken(serviceAccountEmail, adminEmail, DIRECTORY_DOMAIN_SCOPE);
		await getWorkspaceDomain(directoryToken, domain);
		return;
	}

	// verify-add
	const siteVerificationToken = await getDelegatedAccessToken(
		serviceAccountEmail,
		adminEmail,
		SITE_VERIFICATION_SCOPE,
	);
	await verifyDomain(siteVerificationToken, domain, adminEmail);
	console.log(`Verified ownership of ${domain}.`);

	const directoryToken = await getDelegatedAccessToken(serviceAccountEmail, adminEmail, DIRECTORY_DOMAIN_SCOPE);
	await addWorkspaceDomain(directoryToken, domain);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
