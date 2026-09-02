import { io, Socket } from "socket.io-client";
import { getAccessToken, dedupeRefresh } from "./api/tokens";

export function log(scope: string, msg: string, payload?: unknown) {
	// eslint-disable-next-line no-console
	console.log(`[socket:${scope}]`, msg, payload ?? "");
}

let socket: Socket | null = null;

export function getSocket(): Socket {
	if (socket) return socket;

	const url = window.location.origin;

	socket = io(url, {
		autoConnect: false,
		auth: () => ({ token: getAccessToken() }),
		reconnection: true,
		reconnectionAttempts: Infinity,
		reconnectionDelay: 1_000,
		reconnectionDelayMax: 30_000,
		timeout: 10_000,
		transports: ["websocket", "polling"],
	});

	const s = socket;

	s.on("connect", () => log("lifecycle", "CONNECTED", s.id));
	s.on("disconnect", (reason) => log("lifecycle", "DISCONNECTED", reason));
	s.on("connect_error", async (err) => {
		log("lifecycle", "CONNECT_ERROR", err.message);

		// If it's an auth error, try refreshing the token and retrying.
		if (
			err.message.includes("Invalid or expired token") ||
			err.message.includes("Authentication required")
		) {
			try {
				log("lifecycle", "refreshing token to retry auth");
				await dedupeRefresh();
				// `auth` is a callback that re-reads the token from storage on
				// every attempt, so a plain reconnect picks up the fresh one.
				// (Assigning `s.auth = {…}` here would freeze it and break the
				// *next* refresh.)
				if (getAccessToken()) {
					s.connect();
				}
			} catch {
				log("lifecycle", "token refresh failed — user must re-login");
			}
		}
	});
	s.io.on("reconnect_attempt", (attempt) =>
		log("lifecycle", "RECONNECT_ATTEMPT", attempt),
	);
	s.io.on("reconnect", (attempt) =>
		log("lifecycle", "RECONNECTED", `attempt ${attempt}`),
	);
	s.io.on("reconnect_error", (err) =>
		log("lifecycle", "RECONNECT_ERROR", err.message),
	);

	return socket;
}

export function connectSocket() {
	const s = getSocket();
	log("lifecycle", "connectSocket() called", `connected=${s.connected}`);
	if (!s.connected) {
		s.connect();
	}
	return s;
}

export function disconnectSocket() {
	if (socket) {
		log("lifecycle", "disconnectSocket() called");
		socket.disconnect();
		socket = null;
	}
}
