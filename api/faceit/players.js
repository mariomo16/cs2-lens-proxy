import { faceitFetch } from "../_lib/faceit-client.js";
import { createHandler } from "../_lib/handler.js";

function buildPlayersUrl(query) {
	const { nickname, game, game_player_id } = query;

	if (nickname) {
		if (game || game_player_id) {
			return {
				error: "'nickname' cannot be combined with 'game' or 'game_player_id'",
				status: 400,
			};
		}
		return { path: `/players?nickname=${encodeURIComponent(nickname)}` };
	}

	if (!game || !game_player_id) {
		return {
			error: "Provide 'nickname' alone, or both 'game' and 'game_player_id'",
			status: 400,
		};
	}

	const params = new URLSearchParams({ game, game_player_id });
	return { path: `/players?${params}` };
}

export default createHandler(async (req, res) => {
	const { path, error, status } = buildPlayersUrl(req.query);
	if (error) {
		return res.status(status).json({ error });
	}

	const data = await faceitFetch(path, res);
	if (data) res.status(200).json(data);
});
