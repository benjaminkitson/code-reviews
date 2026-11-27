import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import type { DashboardParams } from "@/lib/dashboard";
import { deleteSavedView, saveView, type SaveViewState } from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const params: DashboardParams = {
  indicator: "SP.POP.TOTL",
  year: null,
  countries: ["USA", "GBR"],
  order: "ASC",
  region: "South Asia",
};

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  vi.clearAllMocks();
});

function respondWith(body: unknown) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
}

function formWithName(name: string) {
  const form = new FormData();
  form.set("name", name);
  return form;
}

describe("saveView", () => {
  let state: SaveViewState;

  describe("when the API SUCCEEDS", () => {
    beforeEach(async () => {
      respondWith({ data: { saveView: { id: 1 } } });
      state = await saveView(params, { outcome: "idle" }, formWithName("My view"));
    });

    it("sends the name with the current settings", () => {
      expect(JSON.parse(fetchMock.mock.lastCall?.[1].body).variables).toEqual({
        input: { ...params, name: "My view" },
      });
    });

    it("reports the saved name", () => {
      expect(state).toEqual({ outcome: "saved", name: "My view" });
    });

    it("refreshes the dashboard", () => {
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    });
  });

  describe("when the API REJECTS the view", () => {
    beforeEach(async () => {
      respondWith({ errors: [{ message: 'A view called "My view" already exists.' }] });
      state = await saveView(params, { outcome: "idle" }, formWithName("My view"));
    });

    it("returns the API's message with the typed name", () => {
      expect(state).toEqual({ outcome: "failed", name: "My view", error: 'A view called "My view" already exists.' });
    });
  });

  describe("when the API is UNREACHABLE", () => {
    beforeEach(async () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));
      state = await saveView(params, { outcome: "idle" }, formWithName("My view"));
    });

    it("returns a plain explanation with the typed name", () => {
      expect(state).toEqual({
        outcome: "failed",
        name: "My view",
        error: "Couldn't reach the server, so the view wasn't saved. Please try again.",
      });
    });
  });
});

describe("deleteSavedView", () => {
  let error: string | null;

  describe("when the API SUCCEEDS", () => {
    beforeEach(async () => {
      respondWith({ data: { deleteSavedView: true } });
      error = await deleteSavedView(7);
    });

    it("sends the view's id", () => {
      expect(JSON.parse(fetchMock.mock.lastCall?.[1].body).variables).toEqual({ id: 7 });
    });

    it("returns no error", () => {
      expect(error).toBeNull();
    });

    it("refreshes the dashboard", () => {
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    });
  });

  describe("when the API REJECTS the delete", () => {
    beforeEach(async () => {
      respondWith({ errors: [{ message: "Something went wrong." }] });
      error = await deleteSavedView(7);
    });

    it("returns the API's message", () => {
      expect(error).toBe("Something went wrong.");
    });
  });

  describe("when the API is UNREACHABLE", () => {
    beforeEach(async () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));
      error = await deleteSavedView(7);
    });

    it("returns a plain explanation", () => {
      expect(error).toBe("Couldn't reach the server, so the view wasn't deleted. Please try again.");
    });
  });
});
