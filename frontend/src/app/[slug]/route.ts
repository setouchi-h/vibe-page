import {
	contentTypeForPath,
	getVibeBindings,
	isValidSlug,
	readSiteMeta,
	siteFileKey,
} from "@/lib/vibe-deploy";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type RouteContext = {
	params: Promise<{
		slug: string;
	}>;
};

export async function GET(_request: Request, context: RouteContext) {
	const { slug } = await context.params;

	if (!isValidSlug(slug)) {
		return notFound();
	}

	const { kv, bucket } = await getVibeBindings();
	const meta = await readSiteMeta(kv, slug);

	if (!meta) {
		return notFound();
	}

	const object = await bucket.get(siteFileKey(slug, "index.html"));

	if (!object) {
		return notFound();
	}

	const headers = new Headers({
		"Content-Type": contentTypeForPath("index.html"),
		"Cache-Control": "no-store",
	});
	object.writeHttpMetadata(headers);

	return new Response(object.body, {
		headers,
	});
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
