import { applyCors } from "../../../../../_lib/cors.js";

export default async function handler(req, res) {
	if (applyCors(req, res)) return;

	if (req.method !== "GET") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const { game_id, region, country, offset, limit } = req.query;

	if (!game_id || !region) {
		return res
			.status(400)
			.json({ error: "Missing required path parameters: game_id and region" });
	}

	let url = `https://open.faceit.com/data/v4/rankings/games/${encodeURIComponent(game_id)}/regions/${encodeURIComponent(region)}`;

	const params = new URLSearchParams();
	if (country) params.append("country", country);
	if (offset !== undefined) params.append("offset", offset);
	if (limit !== undefined) params.append("limit", limit);
	const qs = params.toString();
	if (qs) url += `?${qs}`;

	try {
		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${process.env.FACEIT_API_KEY}`,
			},
		});

		if (!response.ok) {
			const errorBody = await response.text();
			console.error("Faceit error", response.status, errorBody);
			return res.status(response.status).json({
				error: "Faceit API request failed",
			});
		}

		const data = await response.json();
		return res.status(200).json(data);
	} catch (_err) {
		return res.status(500).json({ error: "Internal server error" });
	}
}
