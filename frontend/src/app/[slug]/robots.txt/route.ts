import { ROBOTS_BODY } from "@/lib/vibe-deploy";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export function GET() {
	return new Response(ROBOTS_BODY, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "no-store",
		},
	});
}
