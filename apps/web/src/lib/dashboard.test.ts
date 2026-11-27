import { describe, expect, it } from "vitest";
import { matchingView, parseParams, toSearchParams, viewProblem, type DashboardParams } from "./dashboard";

const view: DashboardParams = {
  indicator: "SP.POP.TOTL",
  year: 2000,
  countries: ["USA", "GBR"],
  order: "ASC",
  region: "East Asia & Pacific",
};

describe("toSearchParams", () => {
  describe("when every setting is SET", () => {
    it("round-trips through parseParams", () => {
      expect(parseParams(Object.fromEntries(new URLSearchParams(toSearchParams(view))))).toEqual(view);
    });
  });

  describe("when the year is NULL", () => {
    it("leaves the year out", () => {
      expect(new URLSearchParams(toSearchParams({ ...view, year: null })).has("year")).toBe(false);
    });
  });

  describe("when the region is NULL", () => {
    it("leaves the region out", () => {
      expect(new URLSearchParams(toSearchParams({ ...view, region: null })).has("region")).toBe(false);
    });
  });
});

describe("viewProblem", () => {
  const meta = {
    indicators: [{ code: "SP.POP.TOTL", name: "Population", latestYear: 2023, yearRange: { min: 1960, max: 2023 } }],
    countries: [
      { code: "USA", name: "United States", region: "North America" },
      { code: "GBR", name: "United Kingdom", region: "Europe & Central Asia" },
    ],
    dataSummary: { regions: ["East Asia & Pacific", "Europe & Central Asia"] },
  };

  describe("when everything in the view still EXISTS", () => {
    it("returns null", () => {
      expect(viewProblem(view, meta)).toBeNull();
    });
  });

  describe("when the year is NULL", () => {
    it("returns null", () => {
      expect(viewProblem({ ...view, year: null }, meta)).toBeNull();
    });
  });

  describe("when the region is NULL", () => {
    it("returns null", () => {
      expect(viewProblem({ ...view, region: null }, meta)).toBeNull();
    });
  });

  describe("when the indicator is MISSING", () => {
    it("names the missing indicator", () => {
      expect(viewProblem({ ...view, indicator: "XX.GONE" }, meta)).toBe(
        "The indicator “XX.GONE” is no longer available.",
      );
    });
  });

  describe("when a country is MISSING", () => {
    it("names the missing countries", () => {
      expect(viewProblem({ ...view, countries: ["USA", "ZZZ", "YYY"] }, meta)).toBe(
        "These countries are no longer available: ZZZ, YYY.",
      );
    });
  });

  describe("when the region is MISSING", () => {
    it("names the missing region", () => {
      expect(viewProblem({ ...view, region: "Atlantis" }, meta)).toBe("The region “Atlantis” is no longer available.");
    });
  });

  describe("when the year is OUTSIDE the indicator's data", () => {
    it("names the year", () => {
      expect(viewProblem({ ...view, year: 1950 }, meta)).toBe("The indicator has no data for 1950.");
    });
  });

  describe("when the indicator has NO data", () => {
    it("names the year", () => {
      const indicators = [{ ...meta.indicators[0], yearRange: null }];
      expect(viewProblem(view, { ...meta, indicators })).toBe("The indicator has no data for 2000.");
    });
  });
});

describe("matchingView", () => {
  const views = [
    { ...view, id: 1, name: "Other", indicator: "NY.GDP.PCAP.CD" },
    { ...view, id: 2, name: "Population" },
  ];

  function matchingName(params: DashboardParams) {
    return matchingView(views, params)?.name;
  }

  describe("when a view has EXACTLY the current settings", () => {
    it("returns that view", () => {
      expect(matchingName(view)).toBe("Population");
    });
  });

  describe("when the year is NULL instead of the saved year", () => {
    it("returns nothing", () => {
      expect(matchingName({ ...view, year: null })).toBeUndefined();
    });
  });

  describe("when the SAVED year is NULL but the current year is set", () => {
    it("returns nothing", () => {
      expect(matchingView([{ ...view, id: 3, name: "Latest", year: null }], view)).toBeUndefined();
    });
  });

  describe("when the ranking order DIFFERS", () => {
    it("returns nothing", () => {
      expect(matchingName({ ...view, order: "DESC" })).toBeUndefined();
    });
  });

  describe("when the countries are in a DIFFERENT order", () => {
    it("returns nothing", () => {
      expect(matchingName({ ...view, countries: ["GBR", "USA"] })).toBeUndefined();
    });
  });

  describe("when the region DIFFERS", () => {
    it("returns nothing", () => {
      expect(matchingName({ ...view, region: null })).toBeUndefined();
    });
  });
});
