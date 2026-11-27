import Link from "next/link";
import { redirect } from "next/navigation";
import { fetchDashboardMeta, fetchSavedView, toSearchParams, viewProblem } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Saved view · Code Reviews" };

type PageProps = { params: Promise<{ id: string }> };

async function problemOpeningView(rawId: string): Promise<string> {
  if (!/^\d{1,9}$/.test(rawId)) return "There’s no saved view at this address.";

  let view;
  let meta;
  try {
    [view, meta] = await Promise.all([fetchSavedView(Number(rawId)), fetchDashboardMeta()]);
  } catch {
    return "Couldn’t reach the server to open this view. Please try again.";
  }

  if (!view) return "This saved view no longer exists. It may have been deleted.";

  const problem = viewProblem(view, meta);
  if (problem) return `“${view.name}” can’t be shown. ${problem}`;

  redirect(`/dashboard?${toSearchParams(view)}`);
}

export default async function OpenSavedViewPage({ params }: PageProps) {
  const problem = await problemOpeningView((await params).id);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        <p className="font-medium">{problem}</p>
        <Link href="/dashboard" className="mt-2 inline-block font-medium underline underline-offset-4">
          Back to the dashboard
        </Link>
      </div>
    </main>
  );
}
