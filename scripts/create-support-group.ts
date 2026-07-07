/**
 * Creates a "support@<domain>" Google Group in the Workspace via the Admin SDK
 * Directory API. Authenticates by exchanging Workload Identity Federation
 * credentials for a domain-wide-delegated access token (IAM Credentials
 * signJwt + JWT-bearer token exchange) — no service account key involved.
 * See docs/adr for the rationale; run via the "Provision support group" GitHub
 * Actions workflow, or locally after `gcloud auth application-default login`
 * with signJwt permission on WORKSPACE_SA_EMAIL.
 *
 * Required env vars:
 *   SUPPORT_GROUP_DOMAIN       e.g. "newapp.com"
 *   WORKSPACE_ADMIN_EMAIL      Workspace admin to impersonate (needs Groups Admin
 *                              or Super Admin privileges; this is the DWD "sub")
 * Optional:
 *   WORKSPACE_SA_EMAIL         defaults to workspace-group-provisioner@kornsour.iam.gserviceaccount.com
 *   SUPPORT_GROUP_OWNER_EMAIL  defaults to WORKSPACE_ADMIN_EMAIL; added as group OWNER
 */
import { GoogleAuth } from "google-auth-library";

const DIRECTORY_GROUP_SCOPE = "https://www.googleapis.com/auth/admin.directory.group";
const DEFAULT_SERVICE_ACCOUNT = "workspace-group-provisioner@kornsour.iam.gserviceaccount.com";

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Missing required env var: ${name}`);
	return value;
}

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

function directoryRequest(accessToken: string, path: string, init: RequestInit = {}) {
	return fetch(`https://admin.googleapis.com/admin/directory/v1${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
			...init.headers,
		},
	});
}

async function main() {
	const domain = requireEnv("SUPPORT_GROUP_DOMAIN");
	const adminEmail = requireEnv("WORKSPACE_ADMIN_EMAIL");
	const serviceAccountEmail = process.env.WORKSPACE_SA_EMAIL || DEFAULT_SERVICE_ACCOUNT;
	const ownerEmail = process.env.SUPPORT_GROUP_OWNER_EMAIL || adminEmail;
	const groupEmail = `support@${domain}`;

	const accessToken = await getDelegatedAccessToken(serviceAccountEmail, adminEmail, DIRECTORY_GROUP_SCOPE);

	const createRes = await directoryRequest(accessToken, "/groups", {
		method: "POST",
		body: JSON.stringify({
			email: groupEmail,
			name: "Support",
			description: `Support inbox for ${domain}`,
		}),
	});

	if (createRes.status === 409) {
		console.log(`Group ${groupEmail} already exists — skipping creation.`);
	} else if (!createRes.ok) {
		throw new Error(`Failed to create group ${groupEmail}: ${createRes.status} ${await createRes.text()}`);
	} else {
		console.log(`Created group ${groupEmail}`);
	}

	const memberRes = await directoryRequest(accessToken, `/groups/${groupEmail}/members`, {
		method: "POST",
		body: JSON.stringify({ email: ownerEmail, role: "OWNER" }),
	});

	if (memberRes.status === 409) {
		console.log(`${ownerEmail} is already a member of ${groupEmail}.`);
	} else if (!memberRes.ok) {
		throw new Error(
			`Failed to add ${ownerEmail} as owner of ${groupEmail}: ${memberRes.status} ${await memberRes.text()}`,
		);
	} else {
		console.log(`Added ${ownerEmail} as OWNER of ${groupEmail}`);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
