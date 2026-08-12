"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  MinimumAvailability,
  MonitorOption,
  QualityProfile,
  RootFolder,
  Settings,
} from "@/lib/types";

/**
 * How right-swipes get added. Choices come live from Radarr, so this stays
 * correct when profiles or root folders change over there.
 */

const MONITOR_LABELS: Record<MonitorOption, string> = {
  movieOnly: "This movie only",
  movieAndCollection: "Movie and its collection",
  none: "Don't monitor",
};

const AVAILABILITY_LABELS: Record<MinimumAvailability, string> = {
  announced: "Announced",
  inCinemas: "In cinemas",
  released: "Released",
};

function freeSpace(bytes?: number) {
  if (!bytes) return "";
  const tb = bytes / 1024 ** 4;
  return tb >= 1
    ? `${tb.toFixed(1)} TB free`
    : `${Math.round(bytes / 1024 ** 3)} GB free`;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-data text-[0.62rem] tracking-[0.22em] text-muted uppercase">
        {label}
      </span>
      {children}
      {hint && (
        <span className="font-body text-[0.82rem] leading-snug text-muted">
          {hint}
        </span>
      )}
    </label>
  );
}

const selectClass =
  "w-full cursor-pointer appearance-none rounded-lg border border-edge bg-surface px-4 py-3 font-data text-sm text-screen focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none";

const inputClass =
  "w-full rounded-lg border border-edge bg-surface px-4 py-3 font-data text-sm text-screen placeholder:text-muted/50 focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none";

/** Address and key, with a Test button so a typo surfaces here, not mid-swipe. */
function ConnectionSection() {
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [keySet, setKeySet] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/connection")
      .then((r) => r.json())
      .then((body) => {
        setUrl(body.url || "");
        setKeySet(Boolean(body.apiKeySet));
      })
      .catch(() => {});
  }, []);

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch("/api/connection/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, apiKey }),
      });
      const body = await res.json();
      setResult(
        res.ok
          ? { ok: true, text: `Connected to ${body.name} ${body.version}` }
          : { ok: false, text: body.error },
      );
    } catch (err) {
      setResult({ ok: false, text: (err as Error).message });
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/connection", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, apiKey }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setKeySet(true);
      setApiKey("");
      setResult({ ok: true, text: "Connection saved." });
    } catch (err) {
      setResult({ ok: false, text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 border-b border-edge pb-8">
      <div>
        <h2 className="font-data text-[0.62rem] tracking-[0.24em] text-screen uppercase">
          Radarr connection
        </h2>
        <p className="font-body mt-2 text-[0.88rem] leading-relaxed text-muted">
          Your key is stored on the server and never sent back to this page.
        </p>
      </div>

      <Field label="Address">
        <input
          className={inputClass}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://192.168.0.10:7878"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <Field
        label="API key"
        hint={
          keySet
            ? "A key is saved. Leave blank to keep it."
            : "Radarr → Settings → General → API Key."
        }
      >
        <input
          className={inputClass}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={keySet ? "••••••••••••••••" : "Paste your API key"}
          type="password"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void test()}
          disabled={testing || !url}
          className="font-data cursor-pointer rounded-full border border-edge px-5 py-2.5 text-[0.6rem] tracking-[0.2em] text-screen uppercase transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          {testing ? "Testing" : "Test"}
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !url}
          className="font-data cursor-pointer rounded-full border border-approved/50 bg-approved/12 px-5 py-2.5 text-[0.6rem] tracking-[0.2em] text-approved uppercase transition-colors hover:bg-approved/20 focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving" : "Save connection"}
        </button>
      </div>

      {result && (
        <p
          role="status"
          className={`font-body text-[0.88rem] leading-relaxed ${
            result.ok ? "text-approved" : "text-restricted"
          }`}
        >
          {result.text}
        </p>
      )}
    </div>
  );
}

export default function SettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [profiles, setProfiles] = useState<QualityProfile[]>([]);
  const [roots, setRoots] = useState<RootFolder[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [current, options] = await Promise.all([
          fetch("/api/settings").then((r) => r.json()),
          fetch("/api/radarr/options").then((r) => r.json()),
        ]);
        if (current.error) throw new Error(current.error);
        if (options.error) throw new Error(options.error);
        setSettings(current);
        setProfiles(options.qualityProfiles);
        setRoots(options.rootFolders);
      } catch (err) {
        setError((err as Error).message);
      }
    }
    void load();
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Couldn't save.");
      setNotice("Saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-edge px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <span className="font-display text-sm tracking-[0.28em] uppercase">
          Settings
        </span>
        <Link
          href="/"
          className="font-data text-[0.62rem] tracking-[0.2em] text-muted uppercase transition-colors hover:text-screen focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none"
        >
          Back to deck
        </Link>
      </header>

      <div className="flex flex-col gap-8 overflow-y-auto px-5 py-6">
        <ConnectionSection />

        {error && !settings && (
          <p className="font-body text-[0.95rem] leading-relaxed text-restricted">
            {error}
          </p>
        )}

        {settings && (
          <div className="flex flex-col gap-7">
            <p className="font-body text-[0.95rem] leading-relaxed text-muted">
              These apply to every movie you swipe right on.
            </p>

            <Field label="Quality profile">
              <select
                className={selectClass}
                value={settings.qualityProfileId}
                onChange={(e) => update("qualityProfileId", Number(e.target.value))}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Root folder">
              <select
                className={selectClass}
                value={settings.rootFolderPath}
                onChange={(e) => update("rootFolderPath", e.target.value)}
              >
                {roots.map((r) => (
                  <option key={r.id} value={r.path}>
                    {r.path} — {freeSpace(r.freeSpace)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Monitor">
              <select
                className={selectClass}
                value={settings.monitor}
                onChange={(e) => update("monitor", e.target.value as MonitorOption)}
              >
                {Object.entries(MONITOR_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Minimum availability"
              hint="How far along a film has to be before Radarr starts looking for it."
            >
              <select
                className={selectClass}
                value={settings.minimumAvailability}
                onChange={(e) =>
                  update("minimumAvailability", e.target.value as MinimumAvailability)
                }
              >
                {Object.entries(AVAILABILITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={settings.searchOnAdd}
                onChange={(e) => update("searchOnAdd", e.target.checked)}
                className="mt-0.5 size-5 shrink-0 cursor-pointer accent-approved"
              />
              <span className="flex flex-col gap-1">
                <span className="font-data text-[0.62rem] tracking-[0.22em] text-screen uppercase">
                  Search on add
                </span>
                <span className="font-body text-[0.82rem] leading-snug text-muted">
                  Start hunting for a release the moment you swipe right.
                </span>
              </span>
            </label>

            <div className="flex items-center gap-4 pb-8">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="font-data cursor-pointer rounded-full border border-approved/50 bg-approved/12 px-6 py-3 text-[0.62rem] tracking-[0.2em] text-approved uppercase transition-colors hover:bg-approved/20 focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none disabled:opacity-40"
              >
                {saving ? "Saving" : "Save"}
              </button>
              {notice && (
                <span
                  role="status"
                  className="font-data text-[0.62rem] tracking-[0.2em] text-muted uppercase"
                >
                  {notice}
                </span>
              )}
              {error && (
                <span
                  role="status"
                  className="font-body text-[0.85rem] text-restricted"
                >
                  {error}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
