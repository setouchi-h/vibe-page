import { getCloudflareContext } from "@opennextjs/cloudflare";

export const HTML_MAX_BYTES = 500 * 1024;
export const SITE_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const SITE_TOTAL_MAX_BYTES = 30 * 1024 * 1024;
export const SITE_MAX_FILES = 100;
export const HTML_CONTENT_TYPE = "text/html; charset=utf-8";
export const ROBOTS_BODY = "User-agent: *\nDisallow: /\n";

const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
const SLUG_PATTERN = /^[a-z2-7]{6,7}$/;
const encoder = new TextEncoder();
const ALLOWED_EXTENSIONS = new Set([
	".html",
	".htm",
	".css",
	".js",
	".png",
	".jpg",
	".jpeg",
	".gif",
	".svg",
	".webp",
	".ico",
	".woff",
	".woff2",
	".ttf",
	".json",
	".txt",
]);
const HTML_EXTENSIONS = new Set([".html", ".htm"]);
const CONTENT_TYPES: Record<string, string> = {
	".html": HTML_CONTENT_TYPE,
	".htm": HTML_CONTENT_TYPE,
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".svg": "image/svg+xml; charset=utf-8",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".json": "application/json; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
};

type VibeCloudflareEnv = CloudflareEnv & {
	VIBE_SITES?: KVNamespace;
	VIBE_SITE_BUCKET?: R2Bucket;
};

export type SiteMeta = {
	slug: string;
	tokenHash: string;
	createdAt: string;
	updatedAt: string;
	fileCount: number;
	totalBytes: number;
};

export type PreparedSiteFile = {
	path: string;
	body: ArrayBuffer | string;
	bytes: number;
	contentType: string;
};

type UploadedSiteFile = {
	path: string;
	file: File;
};

export class VibeDeployError extends Error {
	readonly status: number;

	constructor(message: string, status = 400) {
		super(message);
		this.name = "VibeDeployError";
		this.status = status;
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

export function sitePrefix(slug: string) {
	return `sites/${slug}/`;
}

export function siteFileKey(slug: string, path: string) {
	return `${sitePrefix(slug)}${path}`;
}

export function siteHtmlKey(slug: string) {
	return siteFileKey(slug, "index.html");
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

export function getSiteFilesField(formData: FormData) {
	const uploadedFiles = getUploadedSiteFiles(formData);

	if (uploadedFiles.length === 0) {
		throw new VibeDeployError("サイトフォルダを選択してください。");
	}

	return prepareUploadedSiteFiles(uploadedFiles);
}

export function normalizeSitePath(rawPath: string) {
	const slashPath = rawPath.replaceAll("\\", "/");

	if (!slashPath) {
		throw new VibeDeployError("空のファイルパスは使えません。");
	}

	if (slashPath.includes("\0") || slashPath.includes("?") || slashPath.includes("#")) {
		throw new VibeDeployError(`ファイルパスに使えない文字があります: ${rawPath}`);
	}

	if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(slashPath) || slashPath.startsWith("//")) {
		throw new VibeDeployError(`URL形式のファイルパスは使えません: ${rawPath}`);
	}

	if (slashPath.startsWith("/")) {
		throw new VibeDeployError(`先頭が / のファイルパスは使えません: ${rawPath}`);
	}

	const segments = slashPath.split("/");
	const normalizedSegments: string[] = [];

	for (const segment of segments) {
		if (!segment || segment === ".") {
			continue;
		}

		const decodedSegment = decodePathSegment(segment);

		if (
			segment === ".." ||
			decodedSegment === "." ||
			decodedSegment === ".." ||
			decodedSegment.includes("/") ||
			decodedSegment.includes("\\")
		) {
			throw new VibeDeployError(`安全でないファイルパスは使えません: ${rawPath}`);
		}

		normalizedSegments.push(segment);
	}

	const normalizedPath = normalizedSegments.join("/");

	if (!normalizedPath) {
		throw new VibeDeployError("空のファイルパスは使えません。");
	}

	return normalizedPath;
}

export function contentTypeForPath(path: string) {
	return CONTENT_TYPES[getFileExtension(path)] ?? "application/octet-stream";
}

export async function readSiteMeta(kv: KVNamespace, slug: string) {
	return kv.get<SiteMeta>(siteMetaKey(slug), "json");
}

export async function createSite(kv: KVNamespace, bucket: R2Bucket, html: string) {
	const slug = await allocateSlug(kv);
	const token = createEditToken();
	const tokenHash = await sha256Hex(token);
	const now = new Date().toISOString();
	const files = prepareHtmlSiteFiles(html);
	const meta: SiteMeta = {
		slug,
		tokenHash,
		createdAt: now,
		updatedAt: now,
		fileCount: files.length,
		totalBytes: totalBytesFor(files),
	};

	await putSiteFiles(bucket, slug, files);
	await kv.put(siteMetaKey(slug), JSON.stringify(meta));

	return { meta, token };
}

export async function createSiteFromFiles(kv: KVNamespace, bucket: R2Bucket, files: PreparedSiteFile[]) {
	validatePreparedSiteFiles(files);
	const slug = await allocateSlug(kv);
	const token = createEditToken();
	const tokenHash = await sha256Hex(token);
	const now = new Date().toISOString();
	const meta: SiteMeta = {
		slug,
		tokenHash,
		createdAt: now,
		updatedAt: now,
		fileCount: files.length,
		totalBytes: totalBytesFor(files),
	};

	await putSiteFiles(bucket, slug, files);
	await kv.put(siteMetaKey(slug), JSON.stringify(meta));

	return { meta, token };
}

export async function updateSiteHtml(kv: KVNamespace, bucket: R2Bucket, meta: SiteMeta, html: string) {
	const files = prepareHtmlSiteFiles(html);
	return updateSiteFiles(kv, bucket, meta, files);
}

export async function updateSiteFiles(kv: KVNamespace, bucket: R2Bucket, meta: SiteMeta, files: PreparedSiteFile[]) {
	validatePreparedSiteFiles(files);
	const updatedMeta: SiteMeta = {
		...meta,
		updatedAt: new Date().toISOString(),
		fileCount: files.length,
		totalBytes: totalBytesFor(files),
	};

	await putSiteFiles(bucket, meta.slug, files);
	await deleteSiteFilesExcept(bucket, meta.slug, new Set(files.map((file) => siteFileKey(meta.slug, file.path))));
	await kv.put(siteMetaKey(meta.slug), JSON.stringify(updatedMeta));

	return updatedMeta;
}

export async function deleteSite(kv: KVNamespace, bucket: R2Bucket, slug: string) {
	await deleteAllSiteFiles(bucket, slug);
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
	const publicUrl = new URL(`/${slug}/`, requestUrl);
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

function prepareHtmlSiteFiles(html: string): PreparedSiteFile[] {
	const totalBytes = validateHtml(html);

	return [
		{
			path: "index.html",
			body: html,
			bytes: totalBytes,
			contentType: HTML_CONTENT_TYPE,
		},
	];
}

async function prepareUploadedSiteFiles(uploadedFiles: UploadedSiteFile[]) {
	if (uploadedFiles.length > SITE_MAX_FILES) {
		throw new VibeDeployError(`ファイル数は最大${SITE_MAX_FILES}個までです。`);
	}

	const normalizedPaths = stripCommonRootDirectory(uploadedFiles.map((upload) => normalizeSitePath(upload.path)));
	const rows = uploadedFiles.map((upload, index) => ({
		file: upload.file,
		path: normalizedPaths[index],
	}));
	let totalBytes = 0;

	for (const row of rows) {
		validateAllowedExtension(row.path);

		if (row.file.size > SITE_FILE_MAX_BYTES) {
			throw new VibeDeployError(`単一ファイルは最大${formatBytes(SITE_FILE_MAX_BYTES)}までです: ${row.path}`);
		}

		totalBytes += row.file.size;

		if (totalBytes > SITE_TOTAL_MAX_BYTES) {
			throw new VibeDeployError(`合計サイズは最大${formatBytes(SITE_TOTAL_MAX_BYTES)}までです。`);
		}
	}

	applyIndexHtmlDetection(rows);
	assertUniquePaths(rows.map((row) => row.path));

	return Promise.all(
		rows.map(async (row) => ({
			path: row.path,
			body: await row.file.arrayBuffer(),
			bytes: row.file.size,
			contentType: contentTypeForPath(row.path),
		})),
	);
}

function getUploadedSiteFiles(formData: FormData) {
	const values = formData.getAll("siteFiles").filter(isUploadedFile);
	const pathValues = formData.getAll("sitePaths");

	if (pathValues.length > 0 && pathValues.length !== values.length) {
		throw new VibeDeployError("ファイル数とパス情報が一致しません。もう一度選択してください。");
	}

	return values.map((file, index) => {
		const pathValue = pathValues[index];

		if (pathValue !== undefined && typeof pathValue !== "string") {
			throw new VibeDeployError("ファイルパス情報が正しくありません。");
		}

		return {
			path: pathValue || file.name,
			file,
		};
	});
}

function isUploadedFile(value: FormDataEntryValue): value is File {
	return (
		typeof value === "object" &&
		value !== null &&
		"name" in value &&
		"size" in value &&
		"arrayBuffer" in value &&
		typeof value.name === "string" &&
		value.name.length > 0
	);
}

function stripCommonRootDirectory(paths: string[]) {
	if (paths.length === 0 || paths.some((path) => !path.includes("/")) || paths.includes("index.html")) {
		return paths;
	}

	const firstSegments = paths.map((path) => path.split("/")[0]);
	const commonRoot = firstSegments[0];

	if (!commonRoot || firstSegments.some((segment) => segment !== commonRoot)) {
		return paths;
	}

	return paths.map((path) => path.split("/").slice(1).join("/"));
}

function applyIndexHtmlDetection(rows: Array<{ path: string }>) {
	if (rows.some((row) => row.path === "index.html")) {
		return;
	}

	const htmlRows = rows.filter((row) => HTML_EXTENSIONS.has(getFileExtension(row.path)));

	if (htmlRows.length === 1) {
		htmlRows[0].path = "index.html";
		return;
	}

	throw new VibeDeployError("index.html が見つかりません。");
}

function validatePreparedSiteFiles(files: PreparedSiteFile[]) {
	if (files.length === 0) {
		throw new VibeDeployError("サイトファイルがありません。");
	}

	if (files.length > SITE_MAX_FILES) {
		throw new VibeDeployError(`ファイル数は最大${SITE_MAX_FILES}個までです。`);
	}

	assertUniquePaths(files.map((file) => file.path));
	const totalBytes = totalBytesFor(files);

	if (totalBytes > SITE_TOTAL_MAX_BYTES) {
		throw new VibeDeployError(`合計サイズは最大${formatBytes(SITE_TOTAL_MAX_BYTES)}までです。`);
	}

	for (const file of files) {
		normalizeSitePath(file.path);
		validateAllowedExtension(file.path);

		if (file.bytes > SITE_FILE_MAX_BYTES) {
			throw new VibeDeployError(`単一ファイルは最大${formatBytes(SITE_FILE_MAX_BYTES)}までです: ${file.path}`);
		}
	}

	if (!files.some((file) => file.path === "index.html")) {
		throw new VibeDeployError("index.html が見つかりません。");
	}
}

function validateAllowedExtension(path: string) {
	const extension = getFileExtension(path);

	if (!ALLOWED_EXTENSIONS.has(extension)) {
		throw new VibeDeployError(`許可されていない拡張子です: ${path}`);
	}
}

function getFileExtension(path: string) {
	const fileName = path.split("/").at(-1) ?? "";
	const dotIndex = fileName.lastIndexOf(".");

	if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
		throw new VibeDeployError(`拡張子のないファイルはアップロードできません: ${path}`);
	}

	return fileName.slice(dotIndex).toLowerCase();
}

function assertUniquePaths(paths: string[]) {
	const seen = new Set<string>();

	for (const path of paths) {
		if (seen.has(path)) {
			throw new VibeDeployError(`同じパスのファイルが含まれています: ${path}`);
		}

		seen.add(path);
	}
}

function totalBytesFor(files: PreparedSiteFile[]) {
	return files.reduce((total, file) => total + file.bytes, 0);
}

async function putSiteFiles(bucket: R2Bucket, slug: string, files: PreparedSiteFile[]) {
	await Promise.all(
		files.map((file) =>
			bucket.put(siteFileKey(slug, file.path), file.body, {
				httpMetadata: {
					contentType: file.contentType,
				},
			}),
		),
	);
}

async function deleteSiteFilesExcept(bucket: R2Bucket, slug: string, keepKeys: Set<string>) {
	const keys = (await listSiteKeys(bucket, slug)).filter((key) => !keepKeys.has(key));

	if (keys.length > 0) {
		await bucket.delete(keys);
	}
}

async function deleteAllSiteFiles(bucket: R2Bucket, slug: string) {
	const keys = await listSiteKeys(bucket, slug);

	if (keys.length > 0) {
		await bucket.delete(keys);
	}
}

async function listSiteKeys(bucket: R2Bucket, slug: string) {
	const keys: string[] = [];
	let cursor: string | undefined;

	do {
		const listed = await bucket.list({
			prefix: sitePrefix(slug),
			cursor,
		});

		keys.push(...listed.objects.map((object) => object.key));
		cursor = listed.truncated ? listed.cursor : undefined;
	} while (cursor);

	return keys;
}

function decodePathSegment(segment: string) {
	try {
		return decodeURIComponent(segment);
	} catch {
		throw new VibeDeployError(`ファイルパスのエンコードが正しくありません: ${segment}`);
	}
}

function formatBytes(bytes: number) {
	const mb = bytes / (1024 * 1024);

	if (Number.isInteger(mb)) {
		return `${mb}MB`;
	}

	return `${Math.round(bytes / 1024)}KB`;
}
