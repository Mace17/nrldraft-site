// netlify/functions/send-otp.js
//
// Sends a one-time verification code to a player's email using Resend.
// The Resend API key is read from the Netlify environment variable
// RESEND_API_KEY — never hardcoded here.

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "RESEND_API_KEY environment variable is not set in Netlify.",
      }),
    };
  }

  try {
    const { email, name, otp } = JSON.parse(event.body || "{}");

    if (!email || !otp) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing email or otp" }),
      };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // NOTE: this "from" address must be on a domain you've verified
        // in your Resend account. If verification emails stop arriving,
        // check Resend's dashboard for domain verification status first.
        from: "NRL Draft <onboarding@resend.dev>",
        to: [email],
        subject: "Your NRL Draft verification code",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Hi ${name || "there"},</h2>
            <p>Your verification code for NRL Draft is:</p>
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px;">${otp}</p>
            <p>This code will expire shortly. If you didn't request this, you can ignore this email.</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: "Failed to send email via Resend",
          details: errText,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Unexpected error sending OTP",
        details: err.message,
      }),
    };
  }
};
