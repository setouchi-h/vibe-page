import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Vibe Deploy",
	description: "Paste a single HTML file and publish it with a secret edit URL.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="ja">
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
			</head>
			<body>{children}</body>
		</html>
	);
}
