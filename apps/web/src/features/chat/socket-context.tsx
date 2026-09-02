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
		connectSocket();
		setSocket(s);
		setConnected(s.connected);
	}, [isAuthenticated]);

	// Track live connect/disconnect so consumers re-render on state change.
	useEffect(() => {
		if (!socket) return;
		const onConnect = () => {
			log("provider", "connected=true");
			setConnected(true);
		};
		const onDisconnect = () => {
			log("provider", "connected=false");
			setConnected(false);
		};
		socket.on("connect", onConnect);
		socket.on("disconnect", onDisconnect);
		return () => {
			socket.off("connect", onConnect);
			socket.off("disconnect", onDisconnect);
		};
	}, [socket]);

	return (
		<SocketContext.Provider value={{ socket, connected }}>
			{children}
		</SocketContext.Provider>
	);
}
