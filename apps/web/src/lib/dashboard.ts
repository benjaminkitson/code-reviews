import { gqlFetch } from "@/lib/graphql";

/** Indicators that drive the fixed GDP vs life expectancy scatter. */
export const GDP_PER_CAPITA = "NY.GDP.PCAP.CD";
export const LIFE_EXPECTANCY = "SP.DYN.LE00.IN";
export const POPULATION = "SP.POP.TOTL";

export const DEFAULT_INDICATOR = GDP_PER_CAPITA;
export const DEFAULT_COUNTRIES = ["GBR", "USA", "FRA", "DEU", "JPN"];
export const MAX_COUNTRIES = 8;

export type SortOrder = "ASC" | "DESC";

/** The dashboard's state, all of which lives in the URL query string. */
export type DashboardParams = {
  indicator: string;
  year: number | null; // null = use the indicator's latest year
  countries: string[];
  order: SortOrder;
  region: string | null; // scatter highlight
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseParams(sp: RawSearchParams): DashboardParams {
  const yearRaw = Number(first(sp.year));
  const countries = (first(sp.countries) ?? DEFAULT_COUNTRIES.join(","))
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{3}$/.test(c))
    .slice(0, MAX_COUNTRIES);
  return {
    indicator: first(sp.indicator) ?? DEFAULT_INDICATOR,
    year: Number.isInteger(yearRaw) && yearRaw > 0 ? yearRaw : null,
    countries: countries.length ? countries : DEFAULT_COUNTRIES,
    order: first(sp.order)?.toUpperCase() === "ASC" ? "ASC" : "DESC",
    region: first(sp.region) || null,
  };
}

export function toSearchParams({ indicator, year, countries, order, region }: DashboardParams): string {
  const params = new URLSearchParams({ indicator, countries: countries.join(","), order });
  if (year !== null) params.set("year", String(year));
  if (region) params.set("region", region);
  return params.toString();
}

export function matchingView(views: SavedView[], params: DashboardParams): SavedView | undefined {
  return views.find((view) => toSearchParams(view) === toSearchParams(params));
}

export function viewProblem(
  view: DashboardParams,
  meta: Pick<DashboardMeta, "indicators" | "countries" | "dataSummary">,
): string | null {
  const indicator = meta.indicators.find((i) => i.code === view.indicator);
  if (!indicator) return `The indicator “${view.indicator}” is no longer available.`;

  const missingCountries = view.countries.filter((code) => !meta.countries.some((c) => c.code === code));
  if (missingCountries.length > 0) {
    return `These countries are no longer available: ${missingCountries.join(", ")}.`;
  }

  if (view.region && !meta.dataSummary.regions.includes(view.region)) {
    return `The region “${view.region}” is no longer available.`;
  }

  const range = indicator.yearRange;
  if (view.year !== null && (!range || view.year < range.min || view.year > range.max)) {
    return `The indicator has no data for ${view.year}.`;
  }

  return null;
}

// ---------------------------------------------------------------- types

export type IndicatorMeta = {
  code: string;
  name: string;
  latestYear: number | null;
  yearRange: { min: number; max: number } | null;
};

export type CountryMeta = {
  code: string;
  name: string;
  region: string;
};

export type DashboardSummary = {
  worldPopulation: number;
  worldPopulationYear: number;
  avgLifeExpectancy: number;
  avgLifeExpectancyYear: number;
  countries: number;
  latestYear: number;
};

export type Observation = {
  countryCode: string;
  year: number;
  value: number;
};

export type RankedObservation = {
  value: number;
  country: { code: string; name: string; region: string };
};

export type RegionAverage = {
  region: string;
  regionCode: string;
  average: number;
  countryCount: number;
};

export type CountrySnapshot = {
  country: { code: string; name: string; region: string };
  values: { indicatorCode: string; value: number }[];
};

export type SavedView = DashboardParams & { id: number; name: string };

export type DashboardMeta = {
  savedViews: SavedView[];
  dataSummary: { regions: string[] };
  dashboardSummary: DashboardSummary;
  indicators: IndicatorMeta[];
  countries: CountryMeta[];
};

export type DashboardData = {
  observations: Observation[];
  ranking: RankedObservation[];
  regionAverages: RegionAverage[];
  countrySnapshot: CountrySnapshot[];
};

export type ScatterPoint = {
  code: string;
  name: string;
  region: string;
  gdp: number;
  life: number;
  population: number | null;
};

/** Build scatter points from a snapshot, keeping only countries that have both axes' values. */
export function toScatterPoints(snapshot: CountrySnapshot[]): ScatterPoint[] {
  const points: ScatterPoint[] = [];
  for (const s of snapshot) {
    const get = (code: string) => s.values.find((v) => v.indicatorCode === code)?.value;
    const gdp = get(GDP_PER_CAPITA);
    const life = get(LIFE_EXPECTANCY);
    if (gdp == null || life == null || gdp <= 0) continue;
    points.push({
      code: s.country.code,
      name: s.country.name,
      region: s.country.region,
      gdp,
      life,
      population: get(POPULATION) ?? null,
    });
  }
  return points;
}

// ---------------------------------------------------------------- queries

const SAVED_VIEW_FIELDS = /* GraphQL */ `
  fragment SavedViewFields on SavedView {
    id
    name
    indicator
    year
    countries
    order
    region
  }
`;

const META_QUERY = /* GraphQL */ `
  query DashboardMeta {
    savedViews {
      ...SavedViewFields
    }
    dataSummary {
      regions
    }
    dashboardSummary {
      worldPopulation
      worldPopulationYear
      avgLifeExpectancy
      avgLifeExpectancyYear
      countries
      latestYear
    }
    indicators {
      code
      name
      latestYear
      yearRange {
        min
        max
      }
    }
    countries {
      code
      name
      region
    }
  }
  ${SAVED_VIEW_FIELDS}
`;

const DATA_QUERY = /* GraphQL */ `
  query DashboardData(
    $indicator: String!
    $year: Int!
    $countries: [String!]!
    $order: SortOrder!
    $snapshotIndicators: [String!]!
    $snapshotYear: Int!
  ) {
    observations(indicatorCode: $indicator, countryCodes: $countries) {
      countryCode
      year
      value
    }
    ranking(indicatorCode: $indicator, year: $year, limit: 10, order: $order) {
      value
      country {
        code
        name
        region
      }
    }
    regionAverages(indicatorCode: $indicator, year: $year) {
      region
      regionCode
      average
      countryCount
    }
    countrySnapshot(indicatorCodes: $snapshotIndicators, year: $snapshotYear) {
      country {
        code
        name
        region
      }
      values {
        indicatorCode
        value
      }
    }
  }
`;

export async function fetchDashboardMeta(): Promise<DashboardMeta> {
  return gqlFetch<DashboardMeta>(META_QUERY);
}

const SAVED_VIEW_QUERY = /* GraphQL */ `
  query SavedView($id: Int!) {
    savedView(id: $id) {
      ...SavedViewFields
    }
  }
  ${SAVED_VIEW_FIELDS}
`;

export async function fetchSavedView(id: number): Promise<SavedView | null> {
  return (await gqlFetch<{ savedView: SavedView | null }>(SAVED_VIEW_QUERY, { id })).savedView;
}

export async function fetchDashboardData(params: {
  indicator: string;
  year: number;
  countries: string[];
  order: SortOrder;
  /** Year for the GDP vs life expectancy snapshot (may be earlier than `year`). */
  snapshotYear: number;
}): Promise<DashboardData> {
  return gqlFetch<DashboardData>(DATA_QUERY, {
    ...params,
    snapshotIndicators: [GDP_PER_CAPITA, LIFE_EXPECTANCY, POPULATION],
  });
}
