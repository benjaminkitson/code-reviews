"use client";

import { useActionState } from "react";
import { saveView, type SaveViewState } from "@/app/dashboard/actions";
import type { DashboardParams } from "@/lib/dashboard";

const initialState: SaveViewState = { outcome: "idle" };

export function SavedViews({ params }: { params: DashboardParams }) {
  const [state, saveAction, saving] = useActionState(saveView.bind(null, params), initialState);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-medium">Saved views</h2>
      <form action={saveAction} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Save these settings as
          <input
            name="name"
            defaultValue={state.outcome === "failed" ? state.name : ""}
            placeholder="e.g. G7 GDP per capita"
            className="w-64 max-w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {saving ? "Saving…" : "Save view"}
        </button>
      </form>
      {state.outcome === "failed" && (
        <p role="alert" className="text-sm text-red-800 dark:text-red-200">
          {state.error}
        </p>
      )}
      {state.outcome === "saved" && (
        <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
          Saved “{state.name}”.
        </p>
      )}
    </section>
  );
}
