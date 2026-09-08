/**
 * Every cost on a Dubai property purchase, in one place.
 *
 * The calculator and the written pages both read from this, so a fee cannot be
 * right in one and stale in the other. Each line carries where the figure comes
 * from and when it was last checked, because §4.7 requires it and because a fee
 * table with no date silently becomes wrong.
 *
 * Nothing here is advice, and nothing here is a property. It is arithmetic on
 * numbers a buyer will be asked for anyway.
 */

export const CHECKED = "September 2026";
export const VAT = 0.05;

export type Purchase = "resale" | "offplan";
export type Funding = "cash" | "mortgage";

export interface Inputs {
  /** Agreed price, in dirhams. */
  readonly price: number;
  readonly purchase: Purchase;
  readonly funding: Funding;
  /** Loan as a share of price, 0 to 0.85. Ignored when paying cash. */
  readonly ltv: number;
  /** Agency commission rate. Customary is 2%, and it is negotiable. */
  readonly commission: number;
  /** What the bank values it at, as a share of the agreed price. */
  readonly valuation: number;
  /** Whether the buyer is paying the developer's transfer NOC. */
  readonly payingNoc: boolean;
  /** Optional conveyancer. */
  readonly conveyancing: boolean;
}

export const DEFAULTS: Inputs = {
  price: 1_500_000,
  purchase: "resale",
  funding: "mortgage",
  ltv: 0.8,
  commission: 0.02,
  valuation: 1,
  payingNoc: false,
  conveyancing: false,
};

export interface Line {
  readonly id: string;
  readonly label: string;
  /** How the number is arrived at, in words. */
  readonly basis: string;
  readonly amount: number;
  /** Where the figure comes from. */
  readonly source: string;
  /** True where the amount is a typical range rather than a fixed rate. */
  readonly estimate?: boolean;
}

const DLD_RATE = 0.04;
const MORTGAGE_REG_RATE = 0.0025;
const MORTGAGE_REG_ADMIN = 290;
const TITLE_DEED = 580;
const OQOOD_ADMIN = 40;

/** Trustee office fee. Lower band below AED 500,000. */
function trusteeFee(price: number): number {
  return price < 500_000 ? 2_000 : 4_000;
}

/** Bank valuation. A range in practice; the midpoint is used and flagged. */
const VALUATION_FEE = 3_000;
/** Arrangement fee. Up to 1% of the loan, often negotiated down. */
const ARRANGEMENT_RATE = 0.01;
/** Developer NOC. Wide range and negotiable; midpoint used and flagged. */
const NOC_FEE = 2_000;
const CONVEYANCING_FEE = 7_500;

export function computeCosts(input: Inputs): {
  lines: Line[];
  fees: number;
  deposit: number;
  /** Extra cash caused by a short valuation. Already inside `deposit`. */
  shortfall: number;
  cashToClose: number;
  loan: number;
} {
  const { price, purchase, funding, ltv, commission, valuation, payingNoc, conveyancing } = input;
  const lines: Line[] = [];

  // The bank lends against the lower of its valuation and the agreed price. A
  // short valuation therefore shrinks the loan, and the deposit grows by the
  // same amount, because the seller is still owed the full agreed price.
  //
  // The deposit below already contains that. `shortfallExtra` is how much of it
  // exists only because of the gap, reported so a reader can see the cost of a
  // short valuation, and deliberately NOT added to the total again: the loan is
  // a share of the valuation, so the extra cash is ltv x gap, not the whole gap.
  const valuedAt = Math.round(price * valuation);
  const lendingBase = Math.min(price, valuedAt);
  const loan = funding === "mortgage" ? Math.round(lendingBase * ltv) : 0;
  const deposit = price - loan;
  const shortfall =
    funding === "mortgage" ? Math.round(Math.max(0, price - valuedAt) * ltv) : 0;

  lines.push({
    id: "dld",
    label: "DLD transfer fee",
    basis: "4% of the price",
    amount: Math.round(price * DLD_RATE),
    source: "Dubai Land Department",
  });

  lines.push({
    id: "title",
    label: purchase === "offplan" ? "Oqood registration" : "Title deed issuance",
    basis: purchase === "offplan" ? "Fixed, off-plan" : "Fixed, apartments and offices",
    amount: purchase === "offplan" ? OQOOD_ADMIN : TITLE_DEED,
    source: "Dubai Land Department",
  });

  if (purchase === "resale") {
    lines.push({
      id: "trustee",
      label: "Registration trustee fee",
      basis: price < 500_000 ? "Below AED 500,000 band, plus VAT" : "Standard band, plus VAT",
      amount: Math.round(trusteeFee(price) * (1 + VAT)),
      source: "Registration trustee tariff",
    });
  }

  if (commission > 0) {
    lines.push({
      id: "agency",
      label: "Agency commission",
      basis: `${(commission * 100).toFixed(commission * 100 % 1 ? 1 : 0)}% of the price, plus VAT. Customary, not fixed`,
      amount: Math.round(price * commission * (1 + VAT)),
      source: "Market practice. Negotiable",
    });
  }

  if (payingNoc && purchase === "resale") {
    lines.push({
      id: "noc",
      label: "Developer no objection certificate",
      basis: "Typically AED 500 to 5,000. Customarily the seller's, often negotiated",
      amount: NOC_FEE,
      source: "Varies by developer",
      estimate: true,
    });
  }

  if (funding === "mortgage") {
    lines.push({
      id: "mortgage-reg",
      label: "Mortgage registration",
      basis: "0.25% of the loan, plus a fixed charge",
      amount: Math.round(loan * MORTGAGE_REG_RATE + MORTGAGE_REG_ADMIN),
      source: "Dubai Land Department",
    });
    lines.push({
      id: "valuation",
      label: "Bank valuation",
      basis: "Typically AED 2,500 to 3,500, plus VAT",
      amount: Math.round(VALUATION_FEE * (1 + VAT)),
      source: "Varies by lender",
      estimate: true,
    });
    lines.push({
      id: "arrangement",
      label: "Bank arrangement fee",
      basis: "Up to 1% of the loan, plus VAT. Often negotiable",
      amount: Math.round(loan * ARRANGEMENT_RATE * (1 + VAT)),
      source: "Varies by lender. Negotiable",
      estimate: true,
    });
  }

  if (conveyancing) {
    lines.push({
      id: "conveyancing",
      label: "Conveyancing",
      basis: "Optional. Typically AED 6,000 to 10,000",
      amount: CONVEYANCING_FEE,
      source: "Market range",
      estimate: true,
    });
  }

  const fees = lines.reduce((sum, l) => sum + l.amount, 0);
  // Deposit already accounts for the smaller loan. Adding the gap here as
  // well would count it twice.
  const cashToClose = deposit + fees;

  return { lines, fees, deposit, shortfall, cashToClose, loan };
}

/** Fees as a share of the price. The number the site exists to publish. */
export function feeShare(input: Inputs): number {
  const { fees } = computeCosts(input);
  return fees / input.price;
}

export const AED = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 0,
});

export const NUM = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 });
