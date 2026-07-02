import { faceitFetch } from "../../_lib/faceit-client.js";
import { createHandler } from "../../_lib/handler.js";

export default createHandler(async (req, res) => {
	const { player_id } = req.query;
	if (!player_id) {
		return res
			.status(400)
			.json({ error: "Missing required path parameter: player_id" });
	}

	const data = await faceitFetch(
		`/players/${encodeURIComponent(player_id)}`,
		res,
	);
	if (data) res.status(200).json(data);
});
