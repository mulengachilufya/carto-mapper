import assert from "node:assert/strict";
import { test } from "node:test";

const base = process.env.CARTOMAPPER_EVAL_URL ?? "http://127.0.0.1:3000";
const places = ["France", "Germany", "Italy", "Spain"];

function data(field, values, options = {}) {
  return {
    table: {
      columns: ["Country", field],
      rows: values.map((value, index) => ({ Country: places[index], [field]: value })),
      rowCount: values.length,
      ...options,
    },
    roles: { nameField: "Country", valueField: field },
  };
}

async function plan(body, expectedStatus = 200) {
  const response = await fetch(new URL("/api/generate-spec", base), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify(result));
  return result;
}

const missing = [
  ["A numeric story needs evidence", { vibe: "Unemployment rate by state, United States" }, /values/],
  ["A location story needs a list", { vibe: "Public universities in Zambia" }, /places or coordinates/],
  ["An empty values column is missing evidence", { vibe: "Renewable energy by country", ...data("Renewable (%)", ["", null, "N/A"]) }, /measured values/],
  ["Counts are never relabelled as rates", { vibe: "Unemployment rate by country", ...data("Unemployment count", [240, 371]) }, /counts or totals/],
  ["Coordinates cannot be filled with zero from blanks", {
    vibe: "Our store locations",
    table: { columns: ["lat", "lon"], rows: [{ lat: "", lon: null }], rowCount: 1 },
    roles: { latField: "lat", lonField: "lon" },
  }, /valid latitude and longitude/],
];

for (const [name, input, issue] of missing) {
  test(name, async () => assert.match((await plan(input, 422)).message, issue));
}

test("A real zero is a measured value", async () => {
  const { spec } = await plan({ vibe: "Renewable energy by country", ...data("Renewable (%)", [0, null]) });
  assert.equal(spec.mapType, "choropleth");
  assert.equal(spec.data.illustrative, undefined);
});

test("An explicit 0.5 percent stays 0.5 percent", async () => {
  const { spec } = await plan({ vibe: "Renewable energy by country", ...data("Renewable", ["0.5%", "0.3%"]) });
  assert.match(spec.data.valueLabel, /%/);
  assert.equal(spec.data.valueFormat, ",~g");
});

test("Explicit fractions use percentage formatting", async () => {
  const { spec } = await plan({ vibe: "Renewable energy by country", ...data("Renewable fraction", [0.5, 0.3]) });
  assert.equal(spec.data.valueFormat, ".1%");
});

test("A raw ratio without declared units stays numeric", async () => {
  const { spec } = await plan({ vibe: "Index by country", ...data("Index", [0.4, 0.2]) });
  assert.equal(spec.data.valueFormat, ",~g");
});

test("An explicit demo is marked in both subtitle and source", async () => {
  const { spec } = await plan({ vibe: "Illustrative renewable energy by country", ...data("Renewable (%)", [14, 40], { illustrative: true }) });
  assert.equal(spec.data.illustrative, true);
  assert.match(spec.subtitle, /illustrative/i);
  assert.match(spec.source, /illustrative/i);
});

test("A political reference map uses boundaries without inventing a table", async () => {
  const { spec, rows } = await plan({ vibe: "Provinces of Japan" });
  assert.equal(spec.mapType, "reference");
  assert.equal(spec.geography.region, "Japan");
  assert.equal(rows, null);
});

test("A footprint can use countries the user explicitly names", async () => {
  const { spec, rows } = await plan({ vibe: "Where we work: France, Germany and Italy" });
  assert.equal(spec.mapType, "footprint");
  assert.deepEqual(rows.map(({ Country }) => Country), places.slice(0, 3));
});

for (const [medium, layout] of [["technical report", "report"], ["feature story", "feature"], ["atlas", "centered"]]) {
  test(`Compose the map for a ${medium}`, async () => {
    const { spec } = await plan({ vibe: `Renewable energy by country for a ${medium}`, ...data("Renewable (%)", [25, 40]) });
    assert.equal(spec.page.layout, layout);
  });
}
