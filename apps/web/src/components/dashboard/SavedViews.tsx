"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { deleteSavedView, saveView, type SaveViewState } from "@/app/dashboard/actions";
import type { DashboardParams, SavedView } from "@/lib/dashboard";

const initialState: SaveViewState = { outcome: "idle" };

type Props = {
  params: DashboardParams;
  views: SavedView[];
};

export function SavedViews({ params, views }: Props) {
  const [state, saveAction, saving] = useActionState(saveView.bind(null, params), initialState);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDeleting] = useTransition();

  function confirmDelete(view: SavedView) {
    if (!window.confirm(`Delete the saved view “${view.name}”? This can't be undone.`)) return;
    startDeleting(async () => {
      setDeleteError(await deleteSavedView(view.id));
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-medium">Saved views</h2>
      {views.length === 0 ? (
        <p className="text-sm text-zinc-500">No saved views yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {views.map((view) => (
            <li
              key={view.id}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs dark:border-zinc-700"
            >
              <Link href={`/views/${view.id}`} className="hover:underline">
                {view.name}
              </Link>
              <button
                type="button"
                aria-label={`Delete ${view.name}`}
                disabled={deleting}
                className="text-zinc-400 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-100"
                onClick={() => confirmDelete(view)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {deleteError && (
        <p role="alert" className="text-sm text-red-800 dark:text-red-200">
          {deleteError}
        </p>
      )}
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
