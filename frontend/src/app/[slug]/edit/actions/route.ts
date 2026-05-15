import { NextResponse } from "next/server";
import {
	VibeDeployError,
	deleteSite,
	getHtmlField,
	getVibeBindings,
	updateSiteHtml,
	verifyEditToken,
} from "@/lib/vibe-deploy";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type RouteContext = {
	params: Promise<{
		slug: string;
	}>;
};

export async function POST(request: Request, context: RouteContext) {
	const { slug } = await context.params;
	const requestUrl = new URL(request.url);
	const token = requestUrl.searchParams.get("key");

	try {
		const { kv, bucket } = await getVibeBindings();
		const meta = await verifyEditToken(kv, slug, token);
		const formData = await request.formData();
		const intent = formData.get("intent");

		if (intent === "delete") {
			await deleteSite(kv, bucket, slug);
			return redirect(new URL(`/${slug}/edit/deleted`, request.url));
		}

		const html = getHtmlField(formData);
		await updateSiteHtml(kv, bucket, meta, html);

		const savedUrl = new URL(`/${slug}/edit/saved`, request.url);
		if (token) {
			savedUrl.searchParams.set("key", token);
		}

		return redirect(savedUrl);
	} catch (error) {
		const message =
			error instanceof VibeDeployError
				? error.message
				: "処理に失敗しました。時間をおいてもう一度試してください。";
		const editUrl = new URL(`/${slug}/edit`, request.url);

		if (token) {
			editUrl.searchParams.set("key", token);
		}

		editUrl.searchParams.set("error", message);
		return redirect(editUrl);
	}
}

function redirect(url: URL) {
	const response = NextResponse.redirect(url, 303);
	response.headers.set("Referrer-Policy", "no-referrer");
	response.headers.set("Cache-Control", "no-store");
	return response;
}
