import {
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import type { Socket } from "socket.io-client";
import { getSocket, connectSocket, disconnectSocket, log } from "@/lib/socket";
import { useAuth } from "@/features/auth/auth-context";

export interface SocketContextValue {
	socket?: Socket;
	connected: boolean;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function useSocket() {
	const ctx = useContext(SocketContext);
	if (!ctx) {
		throw new Error("useSocket must be used within a SocketProvider");
	}
	return ctx.socket ?? undefined;
}

export function useSocketConnected() {
	const ctx = useContext(SocketContext);
	if (!ctx) {
		throw new Error("useSocketConnected must be used within a SocketProvider");
	}
	return ctx.connected;
}

export function SocketProvider({ children }: { children: ReactNode }) {
	const { isAuthenticated } = useAuth();
	const [socket, setSocket] = useState<Socket | undefined>(undefined);
	const [connected, setConnected] = useState(false);
	const prevAuth = useRef<boolean | null>(null);

	useEffect(() => {
		const wasAuthenticated = prevAuth.current;
		prevAuth.current = isAuthenticated;

		// Only tear down on a real logout (authenticated -> not), not on
		// mount/unmount churn (React StrictMode calls cleanup once in dev).
		if (wasAuthenticated && !isAuthenticated) {
			disconnectSocket();
			setSocket(undefined);
			setConnected(false);
			return;
		}

		if (!isAuthenticated) {
			return;
		}

		const s = getSocket();

		// Attach the lifecycle listeners *before* kicking off the connection so
		// a fast localhost handshake that resolves in the same tick can't slip
		// through the gap and leave `connected` stuck at false.
		const onConnect = () => {
			log("provider", "connected=true");
			setConnected(true);
		};
		const onDisconnect = () => {
			log("provider", "connected=false");
			setConnected(false);
		};
		s.on("connect", onConnect);
		s.on("disconnect", onDisconnect);

		connectSocket();
		setSocket(s);
		// Seed from the live socket in case it was already connected (e.g. this
		// effect re-ran without a full teardown).
		setConnected(s.connected);

		return () => {
			s.off("connect", onConnect);
			s.off("disconnect", onDisconnect);
		};
	}, [isAuthenticated]);

	return (
		<SocketContext.Provider value={{ socket, connected }}>
			{children}
		</SocketContext.Provider>
	);
}
