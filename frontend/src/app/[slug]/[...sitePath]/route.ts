import { NextResponse } from "next/server";
import {
	contentTypeForPath,
	getVibeBindings,
	isValidSlug,
	normalizeSitePath,
	readSiteMeta,
	siteFileKey,
} from "@/lib/vibe-deploy";

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

	const resolvedPath = resolvePublicPath(sitePath);

	if (shouldRedirectToDirectoryUrl(resolvedPath, request.url)) {
		return redirectToTrailingSlash(new URL(request.url), ["slug", "sitePath"]);
	}

	const object = await bucket.get(siteFileKey(slug, resolvedPath));

	if (!object) {
		return notFound();
	}

	const headers = new Headers({
		"Content-Type": contentTypeForPath(resolvedPath),
		"Cache-Control": "no-store",
	});

	return new Response(object.body, {
		headers,
	});
}

function resolvePublicPath(pathParts: string[]) {
	const normalizedPath = normalizeSitePath(pathParts.join("/"));

	if (!hasFileExtension(normalizedPath)) {
		return `${normalizedPath}/index.html`;
	}

	return normalizedPath;
}

function shouldRedirectToDirectoryUrl(resolvedPath: string, requestUrl: string) {
	const requestPath = new URL(requestUrl).pathname;
	return resolvedPath.endsWith("/index.html") && !requestPath.endsWith("/");
}

function redirectToTrailingSlash(url: URL, routeParamNames: string[]) {
	url.pathname = `${url.pathname}/`;

	for (const paramName of routeParamNames) {
		url.searchParams.delete(paramName);
	}

	return NextResponse.redirect(url, 308);
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
