import Link from "next/link";
import { VibeDeployError, getVibeBindings, makeSiteUrls, siteHtmlKey, verifyEditToken } from "@/lib/vibe-deploy";
import { SiteFilesForm } from "../../site-files-form";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type PageProps = {
	params: Promise<{
		slug: string;
	}>;
	searchParams: Promise<{
		key?: string;
		error?: string;
	}>;
};

export default async function EditPage({ params, searchParams }: PageProps) {
	const { slug } = await params;
	const { key, error } = await searchParams;
	const result = await loadEditData(slug, key);

	if (!result.ok) {
		return <ErrorMessage message={result.message} />;
	}

	const { fileCount, html, totalBytes, updatedAt } = result;
	const { editPath } = makeSiteUrls("http://local", slug, key);
	const actionPath = editPath.replace("/edit", "/edit/actions");
	const publicPath = `/${slug}/`;
	const isSingleFileSite = fileCount === 1;

	return (
		<main className="mx-auto grid min-h-screen w-full max-w-[920px] content-start gap-6 px-4 py-10 sm:px-6 sm:py-16">
			<header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="grid gap-2">
					<p className="text-xs font-bold uppercase tracking-wider text-teal-700">Vibe Deploy</p>
					<h1 className="text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">編集</h1>
				</div>
				<Link
					className="inline-flex min-h-11 items-center justify-center rounded-md bg-slate-800 px-5 py-3 text-sm font-bold text-white hover:bg-slate-900"
					href={publicPath}
				>
					公開ページ
				</Link>
			</header>

			<section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-6">
				{error ? (
					<p className="rounded-md border-l-4 border-red-700 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
						{error}
					</p>
				) : null}
				<div className="grid gap-1 text-sm text-slate-500 sm:grid-cols-3">
					<p>Files: {fileCount}</p>
					<p>Total: {formatBytes(totalBytes)}</p>
					<p>Updated: {updatedAt}</p>
				</div>
				{isSingleFileSite ? (
					<form className="grid gap-4" method="post" action={actionPath}>
						<input type="hidden" name="intent" value="update" />
						<input type="hidden" name="uploadType" value="html" />
						<div className="grid gap-2">
							<label className="text-sm font-bold text-slate-900" htmlFor="html">
								index.html
							</label>
							<textarea
								className="min-h-[360px] w-full resize-y rounded-md border border-slate-300 bg-slate-50 p-3 font-mono text-sm leading-relaxed text-slate-950 outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/15 sm:min-h-[480px]"
								id="html"
								name="html"
								required
								spellCheck={false}
								defaultValue={html}
							/>
						</div>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<p className="text-sm text-slate-500">最大500KB</p>
							<button
								className="inline-flex min-h-11 items-center justify-center rounded-md bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-800"
								type="submit"
							>
								上書き保存
							</button>
						</div>
					</form>
				) : null}
				<div className="grid gap-3 border-t border-slate-200 pt-5">
					<h2 className="text-xl font-bold text-slate-950">サイト一式を上書き</h2>
					<SiteFilesForm action={actionPath} buttonText="サイト一式を保存する" />
				</div>
				<form method="post" action={actionPath}>
					<input type="hidden" name="intent" value="delete" />
					<button
						className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-red-700 px-5 py-3 text-sm font-bold text-white hover:bg-red-800 sm:w-auto"
						type="submit"
					>
						削除する
					</button>
				</form>
			</section>
		</main>
	);
}

async function loadEditData(slug: string, key?: string) {
	try {
		const { kv, bucket } = await getVibeBindings();
		const meta = await verifyEditToken(kv, slug, key ?? null);
		const object = await bucket.get(siteHtmlKey(slug));

		if (!object) {
			throw new VibeDeployError("HTMLが見つかりません。", 404);
		}

		return {
			ok: true as const,
			html: await object.text(),
			fileCount: meta.fileCount,
			totalBytes: meta.totalBytes,
			updatedAt: meta.updatedAt,
		};
	} catch (caughtError) {
		const message =
			caughtError instanceof VibeDeployError
				? caughtError.message
				: "編集画面を表示できません。時間をおいてもう一度試してください。";
		return {
			ok: false as const,
			message,
		};
	}
}

function formatBytes(bytes: number) {
	if (bytes >= 1024 * 1024) {
		return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`;
	}

	return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function ErrorMessage({ message }: { message: string }) {
	return (
		<main className="mx-auto grid min-h-screen w-full max-w-[720px] content-start gap-6 px-4 py-10 sm:px-6 sm:py-16">
			<header className="grid gap-2">
				<p className="text-xs font-bold uppercase tracking-wider text-teal-700">Vibe Deploy</p>
				<h1 className="text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">編集できません</h1>
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
