import { SiteFilesForm } from "./site-files-form";

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
					AIで作ったサイトを公開する
				</h1>
			</section>

			<section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-6">
				{error ? (
					<p className="rounded-md border-l-4 border-red-700 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
						{error}
					</p>
				) : null}
				<div className="grid gap-1">
					<h2 className="text-xl font-bold text-slate-950">サイトフォルダを公開</h2>
					<p className="text-sm text-slate-500">HTML / CSS / JS / 画像を相対パスのままアップロードできます。</p>
				</div>
				<SiteFilesForm action="/api/sites" buttonText="サイト一式を公開する" />
			</section>
		</main>
	);
}
