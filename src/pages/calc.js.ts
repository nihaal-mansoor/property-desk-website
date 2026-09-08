import type { APIRoute } from "astro";

/**
 * The calculator enhancement, served as a file.
 *
 * Astro inlines a small <script> by default, which a CSP with no unsafe-inline
 * then blocks in production. A prerendered endpoint sidesteps that: it is a real
 * request for a real file, so a nonce is never needed. (§4.1)
 *
 * The page already contains a complete worked example rendered at build time.
 * This only recalculates the same rows in place, so with no JavaScript the page
 * is still a correct, readable answer rather than an empty box.
 */
export const prerender = true;

const JS = `
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const form = $("calc");
  if (!form) return;

  const VAT = 0.05;
  const fmt = new Intl.NumberFormat("en-AE", {
    style: "currency", currency: "AED", maximumFractionDigits: 0,
  });

  function read() {
    const price = Math.max(100000, Number($("price").value) || 0);
    const funding = form.querySelector('input[name="funding"]:checked').value;
    const purchase = form.querySelector('input[name="purchase"]:checked').value;
    return {
      price,
      funding,
      purchase,
      ltv: Number($("ltv").value) / 100,
      commission: Number($("commission").value) / 100,
      valuation: Number($("valuation").value) / 100,
      payingNoc: $("noc").checked,
      conveyancing: $("conveyancing").checked,
    };
  }

  // Mirrors src/lib/costs.ts. Kept in step by the figures living in one place
  // and by the page being rendered from that module at build time.
  function compute(i) {
    const lines = [];
    const valuedAt = Math.round(i.price * i.valuation);
    const lendingBase = Math.min(i.price, valuedAt);
    const loan = i.funding === "mortgage" ? Math.round(lendingBase * i.ltv) : 0;
    const deposit = i.price - loan;
    // ltv x gap, not the whole gap: the loan is a share of the valuation, so a
    // short valuation costs the buyer that share in extra deposit. It is already
    // inside \`deposit\`, so it is reported but never added to the total.
    const shortfall = i.funding === "mortgage"
      ? Math.round(Math.max(0, i.price - valuedAt) * i.ltv) : 0;

    lines.push(["dld", Math.round(i.price * 0.04)]);
    lines.push(["title", i.purchase === "offplan" ? 40 : 580]);
    if (i.purchase === "resale") {
      lines.push(["trustee", Math.round((i.price < 500000 ? 2000 : 4000) * (1 + VAT))]);
    }
    if (i.commission > 0) {
      lines.push(["agency", Math.round(i.price * i.commission * (1 + VAT))]);
    }
    if (i.payingNoc && i.purchase === "resale") lines.push(["noc", 2000]);
    if (i.funding === "mortgage") {
      lines.push(["mortgage-reg", Math.round(loan * 0.0025 + 290)]);
      lines.push(["valuation", Math.round(3000 * (1 + VAT))]);
      lines.push(["arrangement", Math.round(loan * 0.01 * (1 + VAT))]);
    }
    if (i.conveyancing) lines.push(["conveyancing", 7500]);

    const fees = lines.reduce((s, [, a]) => s + a, 0);
    return { lines, fees, deposit, shortfall, loan, cashToClose: deposit + fees };
  }

  function render() {
    const i = read();
    const r = compute(i);

    $("echo-price").textContent = fmt.format(i.price);
    $("ltv-out").textContent = Math.round(i.ltv * 100) + "%";
    $("commission-out").textContent = (i.commission * 100).toFixed(1) + "%";
    $("valuation-out").textContent = Math.round(i.valuation * 100) + "%";
    $("ltv-wrap").hidden = i.funding !== "mortgage";

    // Show only the rows this combination produces, and update the rest.
    const present = new Set(r.lines.map(([id]) => id));
    document.querySelectorAll("[data-line]").forEach((el) => {
      el.hidden = !present.has(el.getAttribute("data-line"));
    });
    r.lines.forEach(([id, amount]) => {
      const row = document.querySelector('[data-line="' + id + '"] [data-amount]');
      if (row) row.textContent = fmt.format(amount);
    });

    $("fees-out").textContent = fmt.format(r.fees);
    $("share-out").textContent = ((r.fees / i.price) * 100).toFixed(1) + "%";
    $("deposit-out").textContent = fmt.format(r.deposit);
    $("cash-out").textContent = fmt.format(r.cashToClose);

    const gap = r.shortfall > 0;
    $("shortfall-row").hidden = !gap;
    $("shortfall-out").textContent = fmt.format(r.shortfall);
    $("valuation-note").textContent = gap
      ? "A " + Math.round((1 - i.valuation) * 100) + "% short valuation raises the deposit by " +
        fmt.format(r.shortfall) + ", because the loan is a share of the lower figure."
      : i.funding === "cash"
        ? "Paying cash, so no lender valuation applies."
        : "At or above the agreed price there is no gap.";
  }

  form.addEventListener("input", render);
  form.addEventListener("change", render);
  $("valuation").addEventListener("input", render);
  render();
})();
`;

export const GET: APIRoute = () =>
  new Response(JS, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
