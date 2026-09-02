import type { Socket } from "socket.io";
import type { ExtendedError } from "socket.io";
import { jwtService } from "../services/service.container";
import type { AccessTokenPayload } from "../helpers/jwt.service";

export interface AuthenticatedSocket extends Socket {
	data: {
		userId: string;
		username: string;
	};
}

export function socketAuthMiddleware(
	socket: Socket,
	next: (err?: ExtendedError) => void,
) {
	try {
		const token =
			(socket.handshake.auth?.token as string | undefined) ??
			(socket.handshake.headers?.authorization?.startsWith("Bearer ")
				? socket.handshake.headers.authorization.split(" ")[1]
				: undefined);

		if (!token) {
			return next(new Error("Authentication required"));
		}

		const payload = jwtService.verifyJwt<AccessTokenPayload>(token);

		socket.data.userId = payload.sub;
		socket.data.username = payload.username;

		next();
	} catch {
		next(new Error("Invalid or expired token"));
	}
}
