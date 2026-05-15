"use client";

import { useId, useMemo, useRef, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { SITE_FILE_MAX_BYTES, SITE_MAX_FILES, SITE_TOTAL_MAX_BYTES } from "@/lib/vibe-deploy";

type SiteFilesFormProps = {
	action: string;
	buttonText: string;
};

type FileWithRelativePath = File & {
	webkitRelativePath?: string;
};

const directoryInputProps = {
	directory: "",
	webkitdirectory: "",
} satisfies InputHTMLAttributes<HTMLInputElement> & {
	directory: string;
	webkitdirectory: string;
};

export function SiteFilesForm({ action, buttonText }: SiteFilesFormProps) {
	const folderInputId = useId();
	const folderInputRef = useRef<HTMLInputElement>(null);
	const [summary, setSummary] = useState("未選択");
	const [error, setError] = useState<string | null>(null);
	const limitText = useMemo(
		() =>
			`${SITE_MAX_FILES}ファイル / 合計${formatBytes(SITE_TOTAL_MAX_BYTES)} / 1ファイル${formatBytes(
				SITE_FILE_MAX_BYTES,
			)}まで`,
		[],
	);

	function updateSummary() {
		const files = selectedFiles();

		if (files.length === 0) {
			setSummary("未選択");
			return;
		}

		const totalBytes = files.reduce((total, file) => total + file.size, 0);
		setSummary(`${files.length}ファイル / ${formatBytes(totalBytes)}`);
		setError(null);
	}

	function handleChange() {
		updateSummary();
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		const form = event.currentTarget;
		const files = selectedFiles();

		form.querySelectorAll("[data-site-path]").forEach((input) => input.remove());

		if (files.length === 0) {
			event.preventDefault();
			setError("サイトフォルダを選択してください。");
			return;
		}

		for (const file of files) {
			const input = document.createElement("input");
			input.type = "hidden";
			input.name = "sitePaths";
			input.value = file.webkitRelativePath || file.name;
			input.dataset.sitePath = "true";
			form.appendChild(input);
		}
	}

	function selectedFiles() {
		return filesFrom(folderInputRef.current);
	}

	return (
		<form className="grid gap-4" action={action} method="post" encType="multipart/form-data" onSubmit={handleSubmit}>
			<input type="hidden" name="uploadType" value="files" />
			<div className="grid gap-2">
				<label className="text-sm font-bold text-slate-900" htmlFor={folderInputId}>
					サイトフォルダ
				</label>
				<input
					{...directoryInputProps}
					className="min-h-11 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-950 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
					id={folderInputId}
					name="siteFiles"
					ref={folderInputRef}
					type="file"
					multiple
					onChange={handleChange}
				/>
			</div>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="grid gap-1 text-sm text-slate-500">
					<p>{summary}</p>
					<p>{limitText}</p>
					{error ? <p className="font-medium text-red-700">{error}</p> : null}
				</div>
				<button
					className="inline-flex min-h-11 items-center justify-center rounded-md bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-800"
					type="submit"
				>
					{buttonText}
				</button>
			</div>
		</form>
	);
}

function filesFrom(input: HTMLInputElement | null) {
	return input?.files ? (Array.from(input.files) as FileWithRelativePath[]) : [];
}

function formatBytes(bytes: number) {
	if (bytes >= 1024 * 1024) {
		return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`;
	}

	return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}
