function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
export async function notifyByEmail(config, lead) {
    const apiKey = process.env["RESEND_API_KEY"];
    const from = process.env["LEAD_FROM_EMAIL"];
    if (!apiKey || !from)
        return { ok: false, reason: "resend_not_configured" };
    const rows = [
        ["Name", lead.name],
        ["Email", lead.email],
        ["Phone", lead.phone],
        ["Page", lead.sourcePage],
        ["Topic", config.topic],
    ];
    if (lead.message)
        rows.push(["Message", lead.message]);
    const html = `<h2>New enquiry &mdash; ${escapeHtml(config.brand)}</h2>` +
        `<table cellpadding="6" style="border-collapse:collapse">` +
        rows
            .map(([k, v]) => `<tr><td style="border:1px solid #ddd"><b>${escapeHtml(k)}</b></td>` +
            `<td style="border:1px solid #ddd">${escapeHtml(v)}</td></tr>`)
            .join("") +
        `</table>` +
        `<p style="color:#666;font-size:12px">Lead #${lead.leadId} &middot; ${escapeHtml(config.domain)}</p>`;
    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                authorization: `Bearer ${apiKey}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                from,
                to: [config.contact.email],
                reply_to: lead.email,
                subject: `${config.brand}: enquiry from ${lead.name}`,
                html,
            }),
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok)
            return { ok: false, reason: `resend_http_${res.status}` };
        return { ok: true };
    }
    catch (err) {
        return { ok: false, reason: err instanceof Error ? err.name : "resend_error" };
    }
}
//# sourceMappingURL=notify.js.map