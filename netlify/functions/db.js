// netlify/functions/db.js
//
// Small helper function used by the admin panel's "Clear all NSW Cup
// rankings" button. It deletes every record in Airtable whose
// Competition field is "NSW Cup" (leaving other competitions untouched).
//
// Uses the same AIRTABLE_TOKEN environment variable as airtable.js.

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
      body: JSON.stringify({ error: "AIRTABLE_TOKEN environment variable is not set in Netlify." }),
    };
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const params = event.queryStringParameters || {};
  const action = params.action || "";

  if (action !== "clear_rankings") {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Unknown action: ${action}` }),
    };
  }

  try {
    let deleted = 0;
    let offset;

    do {
      const url = new URL(airtableUrl(""));
      url.searchParams.set("pageSize", "100");
      url.searchParams.set("filterByFormula", "{Competition}='NSW Cup'");
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
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
