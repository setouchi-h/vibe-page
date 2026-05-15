import { contentTypeForPath, getVibeBindings, isValidSlug, normalizeSitePath, readSiteMeta, siteFileKey } from "@/lib/vibe-deploy";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type RouteContext = {
	params: Promise<{
		slug: string;
		sitePath: string[];
	}>;
};

export async function GET(request: Request, context: RouteContext) {
	const { slug, sitePath } = await context.params;

	if (!isValidSlug(slug)) {
		return notFound();
	}

	const { kv, bucket } = await getVibeBindings();
	const meta = await readSiteMeta(kv, slug);

	if (!meta) {
		return notFound();
	}

	const resolvedPath = resolvePublicPath(sitePath, request.url);
	const object = await bucket.get(siteFileKey(slug, resolvedPath));

	if (!object) {
		return notFound();
	}

	const headers = new Headers({
		"Content-Type": contentTypeForPath(resolvedPath),
		"Cache-Control": "no-store",
	});
	object.writeHttpMetadata(headers);

	return new Response(object.body, {
		headers,
	});
}

function resolvePublicPath(pathParts: string[], requestUrl: string) {
	const requestPath = new URL(requestUrl).pathname;
	const normalizedPath = normalizeSitePath(pathParts.join("/"));

	if (requestPath.endsWith("/") || !hasFileExtension(normalizedPath)) {
		return `${normalizedPath}/index.html`;
	}

	return normalizedPath;
}

function hasFileExtension(path: string) {
	const fileName = path.split("/").at(-1) ?? "";
	return fileName.includes(".");
}

function notFound() {
	return new Response("Not found", {
		status: 404,
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "no-store",
		},
	});
}
