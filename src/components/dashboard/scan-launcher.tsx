"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Globe2, Layers3, Loader2, Play, Settings2 } from "lucide-react";

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
  const router = useRouter();
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

      const nextResult = (await response.json()) as ScanResponse;
      setResult(nextResult);

      if (nextResult.scan?.id) {
        router.push(`/scans/${nextResult.scan.id}`);
      }
    } catch {
      setResult({ error: "Scan request failed." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submitScan}
      aria-busy={isSubmitting}
      className="relative overflow-hidden rounded-lg border border-white/10 bg-[#1a2330]/95 p-5 shadow-2xl shadow-slate-950/25 backdrop-blur sm:p-6"
    >
      {isSubmitting ? (
        <div className="absolute inset-x-0 top-0 h-1 bg-emerald-400/15">
          <div className="h-full w-1/2 animate-pulse rounded-r-full bg-emerald-300" />
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-400 text-slate-950">
            <Globe2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Scan a Website</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Paste one URL or a batch list. Each line or comma becomes a scan.
            </p>
          </div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300">
          <Settings2 className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      <label className="mt-6 block text-sm font-medium text-slate-200" htmlFor="urls">
        Website URL or URL list
      </label>
      <textarea
        id="urls"
        value={urls}
        onChange={(event) => setUrls(event.target.value)}
        placeholder={"example.com\nclientsite.com/about\nclientsite.com/contact"}
        disabled={isSubmitting}
        className="mt-2 min-h-40 w-full rounded-lg border border-emerald-300/30 bg-[#111820] px-4 py-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-400/15 disabled:cursor-wait disabled:border-emerald-300/20 disabled:text-slate-400"
        required
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label
            className="block text-sm font-medium text-slate-300"
            htmlFor="projectName"
          >
            Project
          </label>
          <input
            id="projectName"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Monthly client audit"
            disabled={isSubmitting}
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#202a36] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-400/10 disabled:cursor-wait disabled:text-slate-400"
          />
        </div>
        <div>
          <label
            className="block text-sm font-medium text-slate-300"
            htmlFor="clientName"
          >
            Client
          </label>
          <input
            id="clientName"
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            placeholder="Client name"
            disabled={isSubmitting}
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#202a36] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-400/10 disabled:cursor-wait disabled:text-slate-400"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px]">
        <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#202a36] px-3 py-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={includeSubpages}
            onChange={(event) => setIncludeSubpages(event.target.checked)}
            disabled={isSubmitting}
            className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-emerald-400 disabled:cursor-wait"
          />
          <Layers3 className="h-4 w-4 text-cyan-300" />
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
            disabled={isSubmitting}
            className="h-10 w-full rounded-lg border border-white/10 bg-[#202a36] px-3 text-sm text-white outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-400/10 disabled:cursor-wait disabled:text-slate-400"
          />
        </div>
      </div>

      {isSubmitting ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-5 rounded-lg border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-50"
        >
          <div className="flex items-start gap-3">
            <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-emerald-300" />
            <div>
              <p className="font-semibold">Creating website scan...</p>
              <p className="mt-1 leading-6 text-emerald-100/80">
                Saving the URL list to Postgres and preparing the report record.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        {isSubmitting ? "Creating Scan..." : "Queue Scan"}
      </button>

      {result ? (
        <div className="mt-4 border-l-2 border-amber-300 bg-amber-300/10 p-3 text-sm text-amber-100">
          {result.scan ? (
            <p>
              Scan {result.scan.id} queued for {result.scan.queuedUrlCount} URL
              {result.scan.queuedUrlCount === 1 ? "" : "s"}.
            </p>
          ) : (
            <p>{result.error ?? "Scan could not be queued."}</p>
          )}
          {result.setupRequired ? (
            <p className="mt-2 text-amber-200">
              Start Postgres and run the first migration before queueing scans.
            </p>
          ) : null}
          {result.scan ? (
            <Link
              href={`/scans/${result.scan.id}`}
              className="mt-3 inline-flex text-sm font-semibold text-amber-50 underline underline-offset-4"
            >
              View scan report
            </Link>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
