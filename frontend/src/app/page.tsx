import { HTML_MAX_BYTES } from "@/lib/vibe-deploy";

type PageProps = {
	searchParams: Promise<{
		error?: string;
	}>;
};

export default async function Home({ searchParams }: PageProps) {
	const { error } = await searchParams;

	return (
		<main className="mx-auto grid min-h-screen w-full max-w-[920px] content-start gap-6 px-4 py-12 sm:px-6 sm:py-16">
			<section className="grid gap-2" aria-labelledby="deploy-title">
				<p className="text-xs font-bold uppercase tracking-wider text-teal-700">Vibe Deploy</p>
				<h1 id="deploy-title" className="text-4xl font-bold leading-tight text-slate-950 sm:text-6xl">
					AIで作ったHTMLを貼る
				</h1>
			</section>

			<form
				className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-6"
				action="/api/sites"
				method="post"
			>
				{error ? (
					<p className="rounded-md border-l-4 border-red-700 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
						{error}
					</p>
				) : null}
				<div className="grid gap-2">
					<label className="text-sm font-bold text-slate-900" htmlFor="html">
						index.html
					</label>
					<textarea
						className="min-h-[360px] w-full resize-y rounded-md border border-slate-300 bg-slate-50 p-3 font-mono text-sm leading-relaxed text-slate-950 outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/15 sm:min-h-[480px]"
						id="html"
						name="html"
						required
						maxLength={HTML_MAX_BYTES}
						spellCheck={false}
						placeholder="<!doctype html>"
					/>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm text-slate-500">最大500KB</p>
					<button
						className="inline-flex min-h-11 items-center justify-center rounded-md bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-800"
						type="submit"
					>
						公開する
					</button>
				</div>
			</form>
		</main>
	);
}
