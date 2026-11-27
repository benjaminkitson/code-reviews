import { beforeEach, describe, expect, it } from "vitest";
import { createYoga } from "graphql-yoga";
import { prisma } from "./db.js";
import { schema } from "./schema.js";

type GraphqlResult<T> = { data?: T; errors?: { message: string }[] };

const yoga = createYoga({ schema });

async function executeGraphql<T>(query: string, variables?: Record<string, unknown>): Promise<GraphqlResult<T>> {
  const res = await yoga.fetch("http://localhost/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return (await res.json()) as GraphqlResult<T>;
}

type SaveViewInput = {
  name: string;
  indicator: string;
  year: number | null;
  countries: string[];
  order: "ASC" | "DESC";
  region: string | null;
};

type SavedView = SaveViewInput & { id: number };

const SAVED_VIEW_FIELDS = "id name indicator year countries order region";

const SAVED_VIEWS_QUERY = `query { savedViews { ${SAVED_VIEW_FIELDS} } }`;
const SAVED_VIEW_QUERY = `query ($id: Int!) { savedView(id: $id) { ${SAVED_VIEW_FIELDS} } }`;
const SAVE_VIEW_MUTATION = `mutation ($input: SaveViewInput!) { saveView(input: $input) { ${SAVED_VIEW_FIELDS} } }`;
const DELETE_SAVED_VIEW_MUTATION = `mutation ($id: Int!) { deleteSavedView(id: $id) }`;

const g7View: SaveViewInput = {
  name: "G7",
  indicator: "NY.GDP.PCAP.CD",
  year: 2020,
  countries: ["USA", "GBR"],
  order: "ASC",
  region: "South Asia",
};

function saveView(overrides: Partial<SaveViewInput> = {}) {
  return executeGraphql<{ saveView: SavedView }>(SAVE_VIEW_MUTATION, { input: { ...g7View, ...overrides } });
}

async function saveViewCreatedAt(name: string, createdAt: string) {
  const { data } = await saveView({ name });
  await prisma.savedView.update({ where: { id: data!.saveView.id }, data: { createdAt: new Date(createdAt) } });
}

beforeEach(async () => {
  await prisma.savedView.deleteMany();
});

describe("savedViews", () => {
  async function savedViewNames() {
    const { data } = await executeGraphql<{ savedViews: SavedView[] }>(SAVED_VIEWS_QUERY);
    return data?.savedViews.map((v) => v.name);
  }

  describe("when the views were created at DIFFERENT times", () => {
    beforeEach(async () => {
      await saveViewCreatedAt("January", "2026-01-01");
      await saveViewCreatedAt("March", "2026-03-01");
      await saveViewCreatedAt("February", "2026-02-01");
    });

    it("returns the newest first", async () => {
      expect(await savedViewNames()).toEqual(["March", "February", "January"]);
    });
  });

  describe("when the views were created at the SAME time", () => {
    beforeEach(async () => {
      await saveViewCreatedAt("Saved first", "2026-01-01");
      await saveViewCreatedAt("Saved second", "2026-01-01");
    });

    it("returns the last saved first", async () => {
      expect(await savedViewNames()).toEqual(["Saved second", "Saved first"]);
    });
  });
});

describe("savedView", () => {
  let id: number;

  beforeEach(async () => {
    await saveView({ name: "Other" });
    id = (await saveView()).data!.saveView.id;
  });

  describe("when the id EXISTS", () => {
    it("returns every saved field", async () => {
      const { data } = await executeGraphql<{ savedView: SavedView }>(SAVED_VIEW_QUERY, { id });
      expect(data?.savedView).toEqual({ ...g7View, id });
    });
  });

  describe("when the id is MISSING", () => {
    it("returns null", async () => {
      const { data } = await executeGraphql<{ savedView: null }>(SAVED_VIEW_QUERY, { id: id + 1 });
      expect(data?.savedView).toBeNull();
    });
  });
});

describe("saveView", () => {
  async function saveViewError(overrides: Partial<SaveViewInput>) {
    return (await saveView(overrides)).errors?.[0].message;
  }

  describe("when the name has SURROUNDING WHITESPACE", () => {
    it("saves the name trimmed", async () => {
      expect((await saveView({ name: "  G7  " })).data?.saveView.name).toBe("G7");
    });
  });

  describe("when the name is BLANK", () => {
    let error: string | undefined;

    beforeEach(async () => {
      error = await saveViewError({ name: "   " });
    });

    it("explains that a name is needed", () => {
      expect(error).toBe("Give the view a name.");
    });

    it("stores NOTHING", async () => {
      expect(await prisma.savedView.count()).toBe(0);
    });
  });

  describe("when the name is OVER 60 characters", () => {
    it("explains the limit", async () => {
      expect(await saveViewError({ name: "a".repeat(61) })).toBe("Keep the name to 60 characters or fewer.");
    });
  });

  describe("when the name is EXACTLY 60 characters once trimmed", () => {
    it("saves it", async () => {
      expect((await saveView({ name: ` ${"a".repeat(60)} ` })).data?.saveView.name).toHaveLength(60);
    });
  });

  describe("when a view with that name ALREADY EXISTS", () => {
    beforeEach(async () => {
      await saveView({ name: "G7" });
    });

    it("explains the name is taken", async () => {
      expect(await saveViewError({ name: "G7" })).toBe('A view called "G7" already exists.');
    });

    describe("when the new name differs only by SURROUNDING WHITESPACE", () => {
      it("explains the name is taken", async () => {
        expect(await saveViewError({ name: " G7 " })).toBe('A view called "G7" already exists.');
      });
    });

    describe("when the new name differs only in CASE", () => {
      it("saves it", async () => {
        expect((await saveView({ name: "g7" })).data?.saveView.name).toBe("g7");
      });
    });
  });

  describe("when there are NO countries", () => {
    it("explains which countries are allowed", async () => {
      expect(await saveViewError({ countries: [] })).toBe(
        "Choose between 1 and 8 countries, using three-letter codes such as GBR.",
      );
    });
  });

  describe("when there are MORE THAN 8 countries", () => {
    it("explains which countries are allowed", async () => {
      const nineCountries = ["GBR", "USA", "FRA", "DEU", "JPN", "ITA", "CAN", "IND", "CHN"];
      expect(await saveViewError({ countries: nineCountries })).toBe(
        "Choose between 1 and 8 countries, using three-letter codes such as GBR.",
      );
    });
  });

  describe("when a country is NOT a three-letter code", () => {
    it("explains which countries are allowed", async () => {
      expect(await saveViewError({ countries: ["USA,GBR"] })).toBe(
        "Choose between 1 and 8 countries, using three-letter codes such as GBR.",
      );
    });
  });
});

describe("deleteSavedView", () => {
  let id: number;

  beforeEach(async () => {
    id = (await saveView()).data!.saveView.id;
  });

  function deleteSavedView(viewId: number) {
    return executeGraphql<{ deleteSavedView: boolean }>(DELETE_SAVED_VIEW_MUTATION, { id: viewId });
  }

  describe("when the view EXISTS", () => {
    let result: GraphqlResult<{ deleteSavedView: boolean }>;

    beforeEach(async () => {
      result = await deleteSavedView(id);
    });

    it("returns true", () => {
      expect(result.data?.deleteSavedView).toBe(true);
    });

    it("removes the view", async () => {
      expect(await prisma.savedView.count()).toBe(0);
    });
  });

  describe("when the view is MISSING", () => {
    it("returns false", async () => {
      expect((await deleteSavedView(id + 1)).data?.deleteSavedView).toBe(false);
    });
  });
});
