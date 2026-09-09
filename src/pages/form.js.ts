/**
 * Served as a file, never inlined: the CSP carries no unsafe-inline. (§4.1)
 * Progressive only. The server is the authority on every rule enforced here.
 */
export const prerender = true;

export function GET() {
  const js = `
const form = document.getElementById("lead-form");
if (form) {
  /* The time-trap baseline. Set on load rather than at build, since a static
     page is built once and read for months. */
  const rendered = document.getElementById("f-rendered");
  if (rendered) rendered.value = String(Date.now());
  const page = document.getElementById("f-page");
  if (page) page.value = location.pathname;

  const status = document.getElementById("lead-status");
  const submit = document.getElementById("lead-submit");
  const FIELDS = ["name", "email", "phone", "message", "consent"];

  const clearErrors = () => {
    for (const f of FIELDS) {
      const el = document.getElementById("e-" + f);
      if (el) { el.textContent = ""; el.hidden = true; }
      const input = document.getElementById("f-" + f);
      if (input) input.removeAttribute("aria-invalid");
    }
  };

  const showErrors = (errors) => {
    let first = null;
    for (const [field, message] of Object.entries(errors || {})) {
      const el = document.getElementById("e-" + field);
      const input = document.getElementById("f-" + field);
      if (el) { el.textContent = message; el.hidden = false; }
      if (input) { input.setAttribute("aria-invalid", "true"); first = first || input; }
    }
    if (first) first.focus();
  };

  /* Contextual entry points. Each CTA names what the reader was looking at, so
     the enquiry arrives with its origin attached. */
  for (const btn of document.querySelectorAll("[data-enquire]")) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const topic = btn.getAttribute("data-enquire");
      const sel = document.getElementById("p-name");
      const area = sel && sel.dataset.id ? sel.textContent.trim() : "";
      const field = document.getElementById("f-topic");
      if (field) field.value = area && topic === "area" ? "Area: " + area : topic;
      document.getElementById("enquire").scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
      const name = document.getElementById("f-name");
      if (name) setTimeout(() => name.focus({ preventScroll: true }), 400);
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();
    status.textContent = "Sending...";
    submit.disabled = true;
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        form.hidden = true;
        status.textContent = data.message || "Thanks. We will be in touch.";
        status.classList.add("ok");
        return;
      }
      if (data.errors) showErrors(data.errors);
      /* Generic to the client, detailed server-side. Never leak internals. */
      status.textContent = data.message || "Something went wrong. Please try again.";
    } catch {
      status.textContent = "Could not send. Check your connection and try again.";
    } finally {
      submit.disabled = false;
    }
  });
}
`;
  return new Response(js, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
