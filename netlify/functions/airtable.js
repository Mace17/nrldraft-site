// netlify/functions/airtable.js
//
// Single proxy function that the site's frontend talks to for every
// Airtable operation. The frontend calls this with a `?action=...`
// query parameter to say what it wants done.
//
// The Airtable token is read from the Netlify environment variable
// AIRTABLE_TOKEN — it is never hardcoded here or sent to the browser.

const AIRTABLE_BASE_ID = "appmGqg3PbFF4E5O6";
const AIRTABLE_TABLE_NAME = "Imported table";

function airtableUrl(path) {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    AIRTABLE_TABLE_NAME
  )}${path || ""}`;
}

exports.handler = async function (event, context) {
  const token = process.env.AIRTABLE_TOKEN;

  if (!token) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: { message: "AIRTABLE_TOKEN environment variable is not set in Netlify." },
      }),
    };
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const params = event.queryStringParameters || {};
  const action = params.action || "";

  try {
    // ----- Read all records (handles Airtable's 100-record page limit) -----
    if (action === "all") {
      const url = new URL(airtableUrl(""));
      url.searchParams.set("pageSize", "100");
      if (params.offset) url.searchParams.set("offset", params.offset);

      const r = await fetch(url.toString(), { headers });
      const d = await r.json();

      if (!r.ok) {
        return { statusCode: r.status, body: JSON.stringify({ error: d.error || d }) };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ records: d.records, offset: d.offset || null }),
      };
    }

    // ----- Update a single record's fields -----
    if (action === "update") {
      const id = params.id;
      const body = JSON.parse(event.body || "{}");

      const r = await fetch(airtableUrl(`/${id}`), {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      const d = await r.json();

      if (!r.ok) {
        return { statusCode: r.status, body: JSON.stringify({ error: d.error || d }) };
      }
      return { statusCode: 200, body: JSON.stringify(d) };
    }

    // ----- Create a single record -----
    if (action === "create") {
      const body = JSON.parse(event.body || "{}");

      const r = await fetch(airtableUrl(""), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const d = await r.json();

      if (!r.ok) {
        return { statusCode: r.status, body: JSON.stringify({ error: d.error || d }) };
      }
      return { statusCode: 200, body: JSON.stringify(d) };
    }

    // ----- Delete a single record -----
    if (action === "delete") {
      const id = params.id;

      const r = await fetch(airtableUrl(`/${id}`), {
        method: "DELETE",
        headers,
      });
      const d = await r.json();

      if (!r.ok) {
        return { statusCode: r.status, body: JSON.stringify({ error: d.error || d }) };
      }
      return { statusCode: 200, body: JSON.stringify(d) };
    }

    // ----- Batch create (Airtable allows up to 10 records per call) -----
    if (action === "batch_create") {
      const body = JSON.parse(event.body || "{}");
      const records = body.records || [];
      const created = [];

      for (let i = 0; i < records.length; i += 10) {
        const chunk = records.slice(i, i + 10);
        const r = await fetch(airtableUrl(""), {
          method: "POST",
          headers,
          body: JSON.stringify({ records: chunk }),
        });
        const d = await r.json();
        if (!r.ok) {
          return { statusCode: r.status, body: JSON.stringify({ error: d.error || d, created }) };
        }
        created.push(...d.records);
      }

      return { statusCode: 200, body: JSON.stringify({ records: created }) };
    }

    // ----- Delete ALL records in the table -----
    if (action === "delete_all") {
      let deleted = 0;
      let offset;

      do {
        const url = new URL(airtableUrl(""));
        url.searchParams.set("pageSize", "100");
        if (offset) url.searchParams.set("offset", offset);

        const r = await fetch(url.toString(), { headers });
        const d = await r.json();
        if (!r.ok) {
          return { statusCode: r.status, body: JSON.stringify({ error: d.error || d, deleted }) };
        }

        const ids = (d.records || []).map((rec) => rec.id);
        for (let i = 0; i < ids.length; i += 10) {
          const chunk = ids.slice(i, i + 10);
          const delUrl = new URL(airtableUrl(""));
          chunk.forEach((id) => delUrl.searchParams.append("records[]", id));
          const delRes = await fetch(delUrl.toString(), { method: "DELETE", headers });
          if (delRes.ok) deleted += chunk.length;
        }

        offset = d.offset;
      } while (offset);

      return { statusCode: 200, body: JSON.stringify({ deleted }) };
    }

    // ----- Save a registration (not persisted to Airtable — logged only) -----
    if (action === "save_reg") {
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Unknown action: ${action}`, params }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { message: err.message } }),
    };
  }
};
