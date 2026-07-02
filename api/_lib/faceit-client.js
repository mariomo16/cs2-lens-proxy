const FACEIT_BASE = "https://open.faceit.com/data/v4";

/**
 * Fetches data from the FACEIT API and handles errors uniformly.
 * Returns the parsed JSON on success, or `null` if an error response was already sent.
 *
 * @param {string} path - API path including query string (e.g. "/players?nickname=foo")
 * @param {import("@vercel/node").VercelResponse} res - Vercel response object (used to send error responses)
 * @returns {Promise<object | null>}
 */
export async function faceitFetch(path, res) {
	try {
		const response = await fetch(`${FACEIT_BASE}${path}`, {
			headers: {
				Authorization: `Bearer ${process.env.FACEIT_API_KEY}`,
			},
		});

		if (!response.ok) {
			const errorBody = await response.text();
			console.error("FACEIT API error:", response.status, errorBody);
			res.status(response.status).json({ error: "Faceit API request failed" });
			return null;
		}

		return await response.json();
	} catch (err) {
		console.error("FACEIT fetch failed:", err);
		res.status(500).json({ error: "Internal server error" });
		return null;
	}
}
