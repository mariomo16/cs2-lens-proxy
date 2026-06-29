const ALLOWED_ORIGINS = [
	"chrome-extension://clploogmlpocoolonhlogblopobiccgb",
	"chrome-extension://pminbigcapnnglbbajjfibgpjkkdjfpo",
];

export function applyCors(req, res) {
	const origin = req.headers.origin;
	if (origin && ALLOWED_ORIGINS.includes(origin)) {
		res.setHeader("Access-Control-Allow-Origin", origin);
	}
	res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type");

	if (req.method === "OPTIONS") {
		res.status(204).end();
		return true;
	}
	return false;
}
