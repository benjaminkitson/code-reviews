"use server";

import type { DashboardParams } from "@/lib/dashboard";
import { GraphqlResponseError, gqlFetch } from "@/lib/graphql";

export type SaveViewState =
  | { outcome: "idle" }
  | { outcome: "saved"; name: string }
  | { outcome: "failed"; name: string; error: string };

const SAVE_VIEW_MUTATION = /* GraphQL */ `
  mutation SaveView($input: SaveViewInput!) {
    saveView(input: $input) {
      id
    }
  }
`;

export async function saveView(
  params: DashboardParams,
  _previous: SaveViewState,
  formData: FormData,
): Promise<SaveViewState> {
  const name = String(formData.get("name") ?? "");
  try {
    await gqlFetch(SAVE_VIEW_MUTATION, { input: { ...params, name } });
  } catch (err) {
    if (err instanceof GraphqlResponseError) {
      return { outcome: "failed", name, error: err.message };
    }
    return { outcome: "failed", name, error: "Couldn't reach the server, so the view wasn't saved. Please try again." };
  }
  return { outcome: "saved", name };
}
