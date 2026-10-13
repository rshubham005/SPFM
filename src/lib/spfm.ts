// SPFM calculation engine.
//
// Kept separate from the screens so it can be tested on its own and later
// moved behind the ASP.NET Core API without changing behaviour.
//
// PLACEHOLDER RULES: the formulas below are standard job-costing maths used
// as a stand-in. Replace them with Samuel's SPFM rules, then update the
// test cases in spfm.test.ts with his real project examples.

import type { Project, ProjectInputs, SpfmResults } from "./types";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const pct = (part: number, whole: number) =>
  whole === 0 ? null : round2((part / whole) * 100);

export function calculate(inputs: ProjectInputs): SpfmResults {
  const productRevenue = inputs.products.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const productCost = inputs.products.reduce((s, l) => s + l.qty * l.unitCost, 0);
  const revenue = productRevenue + inputs.variations;
  const labourCost = inputs.labourHours * inputs.labourRate;
  const directCost =
    productCost + labourCost + inputs.subcontractorCost + inputs.otherDirectCost;
  const grossProfit = revenue - directCost;
  const overhead = directCost * (inputs.overheadPct / 100);
  const netProfit = grossProfit - overhead;

  return {
    productRevenue: round2(productRevenue),
    variations: round2(inputs.variations),
    revenue: round2(revenue),
    productCost: round2(productCost),
    labourCost: round2(labourCost),
    subcontractorCost: round2(inputs.subcontractorCost),
    otherDirectCost: round2(inputs.otherDirectCost),
    directCost: round2(directCost),
    grossProfit: round2(grossProfit),
    grossMarginPct: pct(grossProfit, revenue),
    overhead: round2(overhead),
    netProfit: round2(netProfit),
    netMarginPct: pct(netProfit, revenue),
    markupPct: pct(grossProfit, directCost),
  };
}

/** Fingerprint of the inputs, used to tell whether results are out of date. */
export function fingerprint(inputs: ProjectInputs): string {
  return JSON.stringify({
    p: inputs.products.map((l) => [l.description.trim(), l.qty, l.unitCost, l.unitPrice]),
    v: inputs.variations,
    lh: inputs.labourHours,
    lr: inputs.labourRate,
    s: inputs.subcontractorCost,
    o: inputs.otherDirectCost,
    oh: inputs.overheadPct,
  });
}

export type CalcState = "current" | "outdated" | "never";

export function calcState(p: Pick<Project, "inputs" | "results" | "calculatedFor">): CalcState {
  if (!p.results || !p.calculatedFor) return "never";
  return p.calculatedFor === fingerprint(p.inputs) ? "current" : "outdated";
}

export type FieldErrors = Record<string, string>;

type Details = Pick<Project, "name" | "client">;

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Server-side style validation. Keys match the form field names. */
export function validate(details: Details, inputs: ProjectInputs): FieldErrors {
  const e: FieldErrors = {};
  if (!details.name.trim()) e.name = "Enter a project name.";
  if (!details.client.trim()) e.client = "Enter the client's name.";

  if (inputs.products.length === 0) e.products = "Add at least one door or product line.";
  inputs.products.forEach((l, i) => {
    if (!l.description.trim()) e[`products.${i}.description`] = "Describe the item.";
    if (!isNum(l.qty) || l.qty < 1 || !Number.isInteger(l.qty))
      e[`products.${i}.qty`] = "Whole number, 1 or more.";
    if (!isNum(l.unitCost) || l.unitCost < 0) e[`products.${i}.unitCost`] = "0 or more.";
    if (!isNum(l.unitPrice) || l.unitPrice < 0) e[`products.${i}.unitPrice`] = "0 or more.";
  });

  const nonNeg: (keyof ProjectInputs)[] = [
    "variations",
    "labourHours",
    "labourRate",
    "subcontractorCost",
    "otherDirectCost",
  ];
  for (const k of nonNeg) {
    const v = inputs[k];
    if (!isNum(v) || (v as number) < 0) e[k] = "Enter 0 or more.";
  }
  if (!isNum(inputs.overheadPct) || inputs.overheadPct < 0 || inputs.overheadPct > 100)
    e.overheadPct = "Between 0 and 100.";
  return e;
}
