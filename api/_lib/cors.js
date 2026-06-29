const ALLOWED_ORIGIN = "chrome-extension://clploogmlpocoolonhlogblopobiccgb";

export function applyCors(req, res) {
	res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
	res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type");

	if (req.method === "OPTIONS") {
		res.status(204).end();
		return true;
	}
	return false;
}
