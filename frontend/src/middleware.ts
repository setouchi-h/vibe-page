import { NextResponse } from "next/server";

export function middleware() {
	const response = NextResponse.next();
	response.headers.set("Referrer-Policy", "no-referrer");
	return response;
}

export const config = {
	matcher: ["/api/sites", "/:slug/created", "/:slug/edit/:path*"],
};
