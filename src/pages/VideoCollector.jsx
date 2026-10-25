import { useState, useMemo } from "react";

function toSeconds(duration = "00:00:00") {
	const parts = String(duration).trim().split(":").map(Number);

	if (
		parts.length !== 3 ||
		parts.some((n) => !Number.isInteger(n) || n < 0) ||
		parts[1] >= 60 ||
		parts[2] >= 60
	) {
		return 0;
	}

	return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function formatDuration(seconds) {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = seconds % 60;

	return [hours, minutes, remainingSeconds]
		.map((value) => String(value).padStart(2, "0"))
		.join(":");
}

function StatCard({ label, value, inputItem = false, otherProps }) {
	const totalCost =
		Number(otherProps?.totalHours) * Number(otherProps?.value);

	return (
		<div className="min-w-0 rounded-lg border border-gray-200 bg-white p-4">
			<p className="text-sm text-gray-500">{label}</p>
			<p className="mt-2 break-words text-lg font-semibold text-gray-900">
				{value}
			</p>
			{inputItem && (
				<div className="mt-2">
					<input
						type="number"
						min="0"
						step="0.01"
						value={otherProps?.value || ""}
						onChange={otherProps?.onChange}
						placeholder="Per Lecture Cost"
						className="w-1/2 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
					/>

					<span className="ml-2 text-sm text-gray-500">
						Total cost:{" "}
						{Number.isFinite(totalCost) ? totalCost.toFixed(2) : "0.00"}
					</span>
				</div>
			)}
		</div>
	);
}

export default function VideoCollector() {
	const [videos, setVideos] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [status, setStatus] = useState("");
	const [search, setSearch] = useState("");
	const [selectedIds, setSelectedIds] = useState(() => new Set());
	const [courseId, setCourseId] = useState("");
	const [lectureCalculate, setLectureCalculate] = useState("");

	async function fetchAllVideos() {
		if (loading || !courseId.trim()) return;

		setLoading(true);
		setError("");
		setStatus("Loading videos...");
		setVideos([]);
		setSelectedIds(new Set());

		try {
			const apiUrl = import.meta.env.VITE_API_URL;
			if (!apiUrl) {
				throw new Error("VITE_API_URL is missing in .env");
			}

			const response = await fetch(
				`${apiUrl.replace(/\/$/, "")}/${encodeURIComponent(courseId.trim())}/videos`,
			);
			const result = await response.json();

			if (!response.ok || result?.success === false) {
				throw new Error(result?.message || `API error: ${response.status}`);
			}
			if (!Array.isArray(result?.videos)) {
				throw new Error("Unexpected API response: videos must be an array.");
			}

			setVideos(result.videos);
			setStatus(`${result.videos.length} videos loaded.`);
		} catch (err) {
			setError(err.message || "Something went wrong.");
			setStatus("Unable to load videos.");
		} finally {
			setLoading(false);
		}
	}

	const filteredVideos = useMemo(() => {
		const query = search.trim().toLowerCase();

		if (!query) return videos;

		return videos.filter((video) =>
			[video.name, video.tutorName, video.createdAt, video.createdAtText]
				.join(" ")
				.toLowerCase()
				.includes(query),
		);
	}, [videos, search]);

	const selectedVideos = useMemo(
		() => videos.filter((video) => selectedIds.has(String(video.id))),
		[videos, selectedIds],
	);

	const totalSeconds = useMemo(
		() =>
			selectedVideos.reduce(
				(total, video) => total + toSeconds(video.duration),
				0,
			),
		[selectedVideos],
	);

	const totalMinutes = (totalSeconds / 60).toFixed(2);
	const totalHours = (totalSeconds / 3600).toFixed(2);

	function toggleVideo(id) {
		const key = String(id);

		setSelectedIds((previous) => {
			const next = new Set(previous);

			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}

			return next;
		});
	}

	function selectAllVisible() {
		setSelectedIds((previous) => {
			const next = new Set(previous);

			filteredVideos.forEach((video) => {
				next.add(String(video.id));
			});

			return next;
		});
	}

	function clearSelection() {
		setSelectedIds(new Set());
	}

	function escapeCSV(value) {
		const text = String(value ?? "");
		return `"${text.replace(/"/g, '""')}"`;
	}

	function exportCSV(exportVideos, fileName) {
		if (!exportVideos.length) {
			setError("Export karne ke liye koi video available nahi hai.");
			return;
		}

		const headers = [
			"Sr. No.",
			"Video ID",
			"Lecture Name",
			"Duration",
			"Date",
			"Tutor Name",
		];

		const rows = exportVideos.map((video, index) => [
			index + 1,
			video.id,
			video.name,
			video.duration,
			(video.createdAtText || video.createdAt || "")
				.trim()
				.replace(/^On:\s*/, ""),
			video.tutorName,
		]);

		const csvContent = [headers, ...rows]
			.map((row) => row.map(escapeCSV).join(","))
			.join("\r\n");

		// UTF-8 BOM helps Excel display CSV text correctly.
		const blob = new Blob(["\uFEFF", csvContent], {
			type: "text/csv;charset=utf-8;",
		});

		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");

		link.href = url;
		link.download = fileName;
		document.body.appendChild(link);
		link.click();
		link.remove();

		URL.revokeObjectURL(url);
		setError("");
	}

	function exportSelected() {
		exportCSV(selectedVideos, "selected-lectures.csv");
	}

	function exportAll() {
		exportCSV(videos, "all-lectures.csv");
	}

	function renderVideo(video, selected = false) {
		const date = (video.createdAtText || video.createdAt || "")
			.trim()
			.replace(/^On:\s*/, "");

		return (
			<label
				key={video.id}
				className="flex cursor-pointer items-start gap-3 border-b border-gray-100 px-4 py-4 hover:bg-gray-50"
			>
				<input
					type="checkbox"
					checked={selected}
					onChange={() => toggleVideo(video.id)}
					className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-blue-600"
				/>

				<span className="min-w-0 flex-1">
					<span className="block break-words text-sm font-semibold text-gray-800">
						{video.name || "Untitled lecture"}
					</span>

					<span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
						<span
							className={`font-semibold ${(() => {
								const [hours = 0, minutes = 0, seconds = 0] = (
									video?.duration || "00:00:00"
								)
									.split(":")
									.map(Number);

								const totalSeconds = hours * 3600 + minutes * 60 + seconds;

								if (totalSeconds < 3600) return "text-blue-600";
								if (totalSeconds <= 7200) return "text-green-600";
								return "text-red-600";
							})()}`}
						>
							{video?.duration || "00:00:00"}
						</span>

						<span>{date}</span>
						<span>{video.tutorName || "Unknown tutor"}</span>
					</span>
				</span>
			</label>
		);
	}

	return (
		<main className="min-h-screen bg-gray-100 p-4 text-gray-800 sm:p-6">
			{loading && (
				<div
					role="status"
					aria-live="polite"
					className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm"
				>
					<div className="flex flex-col items-center rounded-xl bg-white px-8 py-6 text-center shadow-xl">
						<div
							aria-hidden="true"
							className="h-12 w-12 rounded-full border-4 border-orange-100 border-t-orange-500 motion-safe:animate-spin"
						/>
						<p className="mt-4 font-semibold text-gray-900">
							Loading videos...
						</p>
						<p className="mt-1 text-sm text-gray-500">
							Please wait while we fetch your lectures.
						</p>
					</div>
				</div>
			)}
			<div
				className="mx-auto max-w-[1800px]"
				inert={loading}
				aria-busy={loading}
			>
				<header className="mb-5">
					<h1 className="text-2xl font-semibold">Classplus Video Collector</h1>
					<p className="mt-1 text-sm text-gray-500">
						Collect lectures, select your sessions and calculate total duration.
					</p>
				</header>
				<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
					<div className="flex-1">
						<label
							htmlFor="courseId"
							className="mb-1 block text-sm font-medium text-gray-700"
						>
							Classplus Course ID
						</label>

						<input
							id="courseId"
							type="text"
							value={courseId}
							onChange={(e) => setCourseId(e.target.value)}
							placeholder="Enter course ID"
							className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
						/>
					</div>

					<button
						type="button"
						onClick={fetchAllVideos}
						disabled={loading || !courseId.trim()}
						className="rounded-lg bg-orange-500 px-5 py-2 font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{loading ? "Fetching..." : "Get All Lectures"}
					</button>
				</div>
				<span className="text-sm text-gray-600" role="status">
					{status || "Ready to fetch lectures."}
				</span>

				<div className="flex flex-wrap items-center gap-3 my-2">
					<button
						type="button"
						onClick={exportSelected}
						disabled={selectedVideos.length === 0}
						className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Export Selected ({selectedVideos.length})
					</button>

					<button
						type="button"
						onClick={exportAll}
						disabled={videos.length === 0 || loading}
						className="rounded-lg bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Export All ({videos.length})
					</button>
				</div>

				{error && (
					<div
						role="alert"
						className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
					>
						{error}
					</div>
				)}

				<section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
					<StatCard label="Live Lectures" value={videos.length} />
					<StatCard label="Selected Lectures" value={selectedVideos.length} />
					<StatCard
						label="Total Duration"
						value={formatDuration(totalSeconds)}
					/>
					<StatCard label="Total Minutes" value={`${totalMinutes} min`} />
					<StatCard
						label="Total Hours"
						value={`${totalHours} hrs`}
						inputItem={true}
						otherProps={{
							value: lectureCalculate,
							onChange: (e) => setLectureCalculate(e.target.value),
							totalHours,
						}}
					/>
				</section>

				<section className="grid items-stretch gap-5 lg:grid-cols-2">
					{/* All Content */}
					<article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
						<div className="border-b border-gray-200 p-4">
							<h2 className="text-lg font-bold">All Content</h2>

							<input
								type="search"
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Search session or tutor..."
								className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
							/>

							<p className="mt-2 text-xs text-gray-500">
								Showing {filteredVideos.length} of {videos.length} videos
							</p>
						</div>

						<div className="h-[58vh] min-h-[300px] overflow-y-auto">
							{filteredVideos.length ? (
								filteredVideos.map((video) =>
									renderVideo(video, selectedIds.has(String(video.id))),
								)
							) : (
								<p className="p-8 text-center text-sm text-gray-500">
									{loading ? "Loading videos..." : "No videos found."}
								</p>
							)}
						</div>

						<footer className="mt-auto border-t border-gray-200 p-3">
							<button
								type="button"
								onClick={selectAllVisible}
								disabled={!filteredVideos.length}
								className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
							>
								Select All Visible
							</button>
						</footer>
					</article>

					{/* Selected Content */}
					<article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
						<div className="border-b border-gray-200 p-4">
							<h2 className="text-lg font-bold">Selected Content</h2>
							<p className="mt-2 text-sm text-gray-500">
								{selectedVideos.length} videos selected
							</p>
						</div>

						<div className="h-[58vh] min-h-[300px] overflow-y-auto">
							{selectedVideos.length ? (
								selectedVideos.map((video) => renderVideo(video, true))
							) : (
								<p className="p-8 text-center text-sm text-gray-500">
									Select videos from the left side.
								</p>
							)}
						</div>

						<footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 p-4">
							<div>
								<p className="font-semibold">
									Total: {formatDuration(totalSeconds)}
								</p>
								<p className="mt-1 text-xs text-gray-500">
									{totalHours} hours · {totalMinutes} minutes
								</p>
							</div>

							<button
								type="button"
								onClick={clearSelection}
								disabled={!selectedVideos.length}
								className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
							>
								Clear Selection
							</button>
						</footer>
					</article>
				</section>
			</div>
		</main>
	);
}
