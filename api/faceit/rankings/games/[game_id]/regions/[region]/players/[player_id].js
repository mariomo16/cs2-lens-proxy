import { faceitFetch } from "../../../../../../../_lib/faceit-client.js";
import { createHandler } from "../../../../../../../_lib/handler.js";

export default createHandler(async (req, res) => {
	const { game_id, region, player_id, country, limit } = req.query;

	if (!game_id || !region || !player_id) {
		return res.status(400).json({
			error: "Missing required path parameters: game_id, region, and player_id",
		});
	}

	const params = new URLSearchParams();
	if (country) params.append("country", country);
	params.append("limit", limit ?? "2");

	const data = await faceitFetch(
		`/rankings/games/${encodeURIComponent(game_id)}/regions/${encodeURIComponent(region)}/players/${encodeURIComponent(player_id)}?${params}`,
		res,
	);
	if (data) res.status(200).json(data);
});
