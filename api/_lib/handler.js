import { applyCors } from "./cors.js";

/**
 * Wraps a handler function with CORS and HTTP method validation.
 * Only GET requests are allowed; OPTIONS is handled by CORS.
 *
 * @param {(req: import("@vercel/node").VercelRequest, res: import("@vercel/node").VercelResponse) => Promise<void>} fn
 * @returns {(req: import("@vercel/node").VercelRequest, res: import("@vercel/node").VercelResponse) => Promise<void>}
 */
export function createHandler(fn) {
	return async (req, res) => {
		if (applyCors(req, res)) return;

		if (req.method !== "GET") {
			return res.status(405).json({ error: "Method not allowed" });
		}

		return fn(req, res);
	};
}
