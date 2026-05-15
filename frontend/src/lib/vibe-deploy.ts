import { getCloudflareContext } from "@opennextjs/cloudflare";

export const HTML_MAX_BYTES = 500 * 1024;
export const HTML_CONTENT_TYPE = "text/html; charset=utf-8";
export const ROBOTS_BODY = "User-agent: *\nDisallow: /\n";

const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
const SLUG_PATTERN = /^[a-z2-7]{6,7}$/;
const encoder = new TextEncoder();

type VibeCloudflareEnv = CloudflareEnv & {
	VIBE_SITES?: KVNamespace;
	VIBE_SITE_BUCKET?: R2Bucket;
};

export type SiteMeta = {
	slug: string;
	tokenHash: string;
	createdAt: string;
	updatedAt: string;
	fileCount: 1;
	totalBytes: number;
};

export class VibeDeployError extends Error {
	constructor(
		message: string,
		readonly status = 400,
	) {
		super(message);
		this.name = "VibeDeployError";
	}
}

export async function getVibeBindings() {
	const { env } = await getCloudflareContext({ async: true });
	const vibeEnv = env as VibeCloudflareEnv;

	if (!vibeEnv.VIBE_SITES || !vibeEnv.VIBE_SITE_BUCKET) {
		throw new VibeDeployError("Storage bindings are not configured.", 500);
	}

	return {
		kv: vibeEnv.VIBE_SITES,
		bucket: vibeEnv.VIBE_SITE_BUCKET,
	};
}

export function isValidSlug(slug: string) {
	return SLUG_PATTERN.test(slug);
}

export function siteMetaKey(slug: string) {
	return `site:${slug}`;
}

export function siteHtmlKey(slug: string) {
	return `sites/${slug}/index.html`;
}

export function htmlByteLength(html: string) {
	return encoder.encode(html).byteLength;
}

export function validateHtml(html: string) {
	const totalBytes = htmlByteLength(html);

	if (totalBytes === 0) {
		throw new VibeDeployError("HTMLを貼り付けてください。");
	}

	if (totalBytes > HTML_MAX_BYTES) {
		throw new VibeDeployError("単一HTMLは最大500KBまでです。");
	}

	return totalBytes;
}

export function getHtmlField(formData: FormData) {
	const html = formData.get("html");

	if (typeof html !== "string") {
		throw new VibeDeployError("HTMLを貼り付けてください。");
	}

	return html;
}

export async function readSiteMeta(kv: KVNamespace, slug: string) {
	return kv.get<SiteMeta>(siteMetaKey(slug), "json");
}

export async function createSite(kv: KVNamespace, bucket: R2Bucket, html: string) {
	const totalBytes = validateHtml(html);
	const slug = await allocateSlug(kv);
	const token = createEditToken();
	const tokenHash = await sha256Hex(token);
	const now = new Date().toISOString();
	const meta: SiteMeta = {
		slug,
		tokenHash,
		createdAt: now,
		updatedAt: now,
		fileCount: 1,
		totalBytes,
	};

	await bucket.put(siteHtmlKey(slug), html, {
		httpMetadata: {
			contentType: HTML_CONTENT_TYPE,
		},
	});
	await kv.put(siteMetaKey(slug), JSON.stringify(meta));

	return { meta, token };
}

export async function updateSiteHtml(kv: KVNamespace, bucket: R2Bucket, meta: SiteMeta, html: string) {
	const totalBytes = validateHtml(html);
	const updatedMeta: SiteMeta = {
		...meta,
		updatedAt: new Date().toISOString(),
		totalBytes,
	};

	await bucket.put(siteHtmlKey(meta.slug), html, {
		httpMetadata: {
			contentType: HTML_CONTENT_TYPE,
		},
	});
	await kv.put(siteMetaKey(meta.slug), JSON.stringify(updatedMeta));

	return updatedMeta;
}

export async function deleteSite(kv: KVNamespace, bucket: R2Bucket, slug: string) {
	await bucket.delete(siteHtmlKey(slug));
	await kv.delete(siteMetaKey(slug));
}

export async function verifyEditToken(kv: KVNamespace, slug: string, token: string | null) {
	if (!isValidSlug(slug)) {
		throw new VibeDeployError("サイトが見つかりません。", 404);
	}

	if (!token || token.length > 200) {
		throw new VibeDeployError("編集キーが必要です。", 401);
	}

	const meta = await readSiteMeta(kv, slug);

	if (!meta) {
		throw new VibeDeployError("サイトが見つかりません。", 404);
	}

	const tokenHash = await sha256Hex(token);

	if (!timingSafeEqual(tokenHash, meta.tokenHash)) {
		throw new VibeDeployError("編集キーが正しくありません。", 403);
	}

	return meta;
}

export function makeSiteUrls(requestUrl: string, slug: string, token?: string) {
	const publicUrl = new URL(`/${slug}`, requestUrl);
	const editUrl = new URL(`/${slug}/edit`, requestUrl);

	if (token) {
		editUrl.searchParams.set("key", token);
	}

	return {
		publicUrl: publicUrl.toString(),
		editUrl: editUrl.toString(),
		editPath: `${editUrl.pathname}${editUrl.search}`,
	};
}

async function allocateSlug(kv: KVNamespace) {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const slug = randomBase32(6);

		if (!(await readSiteMeta(kv, slug))) {
			return slug;
		}
	}

	for (let attempt = 0; attempt < 10; attempt += 1) {
		const slug = randomBase32(7);

		if (!(await readSiteMeta(kv, slug))) {
			return slug;
		}
	}

	throw new VibeDeployError("slugを生成できませんでした。もう一度試してください。", 500);
}

function randomBase32(length: number) {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (byte) => BASE32_ALPHABET[byte & 31]).join("");
}

function createEditToken() {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array) {
	let binary = "";

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function sha256Hex(value: string) {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
	if (a.length !== b.length) {
		return false;
	}

	let diff = 0;

	for (let index = 0; index < a.length; index += 1) {
		diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
	}

	return diff === 0;
}
