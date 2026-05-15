import {
	HTML_CONTENT_TYPE,
	getVibeBindings,
	isValidSlug,
	readSiteMeta,
	siteHtmlKey,
	siteMetaKey,
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

	const object = await bucket.get(siteHtmlKey(slug));

	if (!object) {
		await kv.delete(siteMetaKey(slug));
		return notFound();
	}

	return new Response(object.body, {
		headers: {
			"Content-Type": HTML_CONTENT_TYPE,
			"Cache-Control": "no-store",
		},
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
