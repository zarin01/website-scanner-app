"use client";

import { useState } from "react";
import { Loader2, Play, Settings2 } from "lucide-react";

type ScanResponse = {
  scan?: {
    id: string;
    status: string;
    queuedUrlCount: number;
    workerQueued: boolean;
  };
  error?: string;
  setupRequired?: boolean;
};

export function ScanLauncher() {
  const [urls, setUrls] = useState("");
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [includeSubpages, setIncludeSubpages] = useState(false);
  const [maxPages, setMaxPages] = useState(25);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ScanResponse | null>(null);

  async function submitScan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          urls,
          projectName: projectName || undefined,
          clientName: clientName || undefined,
          includeSubpages,
          maxPages,
        }),
      });

      setResult((await response.json()) as ScanResponse);
    } catch {
      setResult({ error: "Scan request failed." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submitScan}
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">New Scan</h2>
          <p className="mt-1 text-sm text-slate-500">Single URL or batch list</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Settings2 className="h-5 w-5" />
        </div>
      </div>

      <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="urls">
        URLs
      </label>
      <textarea
        id="urls"
        value={urls}
        onChange={(event) => setUrls(event.target.value)}
        placeholder="example.com, clientsite.com/about"
        className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        required
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label
            className="block text-sm font-medium text-slate-700"
            htmlFor="projectName"
          >
            Project
          </label>
          <input
            id="projectName"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            className="mt-2 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <div>
          <label
            className="block text-sm font-medium text-slate-700"
            htmlFor="clientName"
          >
            Client
          </label>
          <input
            id="clientName"
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            className="mt-2 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px]">
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={includeSubpages}
            onChange={(event) => setIncludeSubpages(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600"
          />
          Include subpages
        </label>
        <div>
          <label className="sr-only" htmlFor="maxPages">
            Max pages
          </label>
          <input
            id="maxPages"
            type="number"
            min={1}
            max={250}
            value={maxPages}
            onChange={(event) => setMaxPages(Number(event.target.value))}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        Queue Scan
      </button>

      {result ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {result.scan ? (
            <p>
              Scan {result.scan.id} queued for {result.scan.queuedUrlCount} URL
              {result.scan.queuedUrlCount === 1 ? "" : "s"}.
            </p>
          ) : (
            <p>{result.error ?? "Scan could not be queued."}</p>
          )}
          {result.setupRequired ? (
            <p className="mt-2 text-amber-700">
              Start Postgres and run the first migration before queueing scans.
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
