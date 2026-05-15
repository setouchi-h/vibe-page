import Link from "next/link";
import { headers } from "next/headers";
import { isValidSlug, makeSiteUrls } from "@/lib/vibe-deploy";

export const dynamic = "force-dynamic";

type PageProps = {
	params: Promise<{
		slug: string;
	}>;
	searchParams: Promise<{
		key?: string;
	}>;
};

export default async function SavedPage({ params, searchParams }: PageProps) {
	const { slug } = await params;
	const { key } = await searchParams;

	if (!isValidSlug(slug) || !key) {
		return <Message title="保存結果を表示できません" message="URLが正しくありません。" />;
	}

	const { publicUrl, editUrl } = makeSiteUrls(await requestOrigin(), slug, key);

	return (
		<main className="mx-auto grid min-h-screen w-full max-w-[720px] content-start gap-6 px-4 py-10 sm:px-6 sm:py-16">
			<header className="grid gap-2">
				<p className="text-xs font-bold uppercase tracking-wider text-teal-700">Vibe Deploy</p>
				<h1 className="text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">保存しました</h1>
			</header>
			<section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-6">
				<p className="rounded-md border-l-4 border-teal-700 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-950">
					保存しました。反映まで数秒かかる場合あり。
				</p>
				<div className="grid gap-2">
					<label className="text-sm font-bold text-slate-900" htmlFor="public-url">
						公開URL
					</label>
					<input
						className="w-full rounded-md border border-slate-300 bg-slate-50 p-3 font-mono text-sm text-slate-950"
						id="public-url"
						readOnly
						value={publicUrl}
					/>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row">
					<Link
						className="inline-flex min-h-11 items-center justify-center rounded-md bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-800"
						href={publicUrl}
					>
						公開ページを開く
					</Link>
					<Link
						className="inline-flex min-h-11 items-center justify-center rounded-md bg-slate-800 px-5 py-3 text-sm font-bold text-white hover:bg-slate-900"
						href={editUrl}
					>
						編集に戻る
					</Link>
				</div>
			</section>
		</main>
	);
}

function Message({ title, message }: { title: string; message: string }) {
	return (
		<main className="mx-auto grid min-h-screen w-full max-w-[720px] content-start gap-6 px-4 py-10 sm:px-6 sm:py-16">
			<header className="grid gap-2">
				<p className="text-xs font-bold uppercase tracking-wider text-teal-700">Vibe Deploy</p>
				<h1 className="text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">{title}</h1>
			</header>
			<section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
				<p className="rounded-md border-l-4 border-red-700 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
					{message}
				</p>
				<Link
					className="inline-flex min-h-11 items-center justify-center rounded-md bg-slate-800 px-5 py-3 text-sm font-bold text-white hover:bg-slate-900"
					href="/"
				>
					戻る
				</Link>
			</section>
		</main>
	);
}

async function requestOrigin() {
	const requestHeaders = await headers();
	const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
	const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
	return `${protocol}://${host}`;
}
