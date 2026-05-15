import Link from "next/link";

export const dynamic = "force-dynamic";

export default function DeletedPage() {
	return (
		<main className="mx-auto grid min-h-screen w-full max-w-[720px] content-start gap-6 px-4 py-10 sm:px-6 sm:py-16">
			<header className="grid gap-2">
				<p className="text-xs font-bold uppercase tracking-wider text-teal-700">Vibe Deploy</p>
				<h1 className="text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">削除しました</h1>
			</header>
			<section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-6">
				<p className="rounded-md border-l-4 border-teal-700 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-950">
					サイトを削除しました。
				</p>
				<Link
					className="inline-flex min-h-11 items-center justify-center rounded-md bg-slate-800 px-5 py-3 text-sm font-bold text-white hover:bg-slate-900"
					href="/"
				>
					新しく公開する
				</Link>
			</section>
		</main>
	);
}
