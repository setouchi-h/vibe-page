import { NextResponse } from "next/server";
import {
	VibeDeployError,
	createSite,
	createSiteFromFiles,
	getHtmlField,
	getSiteFilesField,
	getVibeBindings,
} from "@/lib/vibe-deploy";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	try {
		const formData = await request.formData();
		const { kv, bucket } = await getVibeBindings();
		const uploadType = formData.get("uploadType");
		const { meta, token } =
			uploadType === "files"
				? await createSiteFromFiles(kv, bucket, await getSiteFilesField(formData))
				: await createSite(kv, bucket, getHtmlField(formData));
		const createdUrl = new URL(`/${meta.slug}/created`, request.url);
		createdUrl.searchParams.set("key", token);

		return redirect(createdUrl);
	} catch (error) {
		const message =
			error instanceof VibeDeployError
				? error.message
				: "公開に失敗しました。時間をおいてもう一度試してください。";
		const errorUrl = new URL("/", request.url);
		errorUrl.searchParams.set("error", message);

		return redirect(errorUrl);
	}
}

function redirect(url: URL) {
	const response = NextResponse.redirect(url, 303);
	response.headers.set("Referrer-Policy", "no-referrer");
	return response;
}
