import { useRef, useCallback } from "preact/hooks";
import { SocketContext, type SocketRecord } from "./SocketContext";
import type {ComponentChildren} from "preact";

type Props = { children: ComponentChildren };

export function SocketProvider({ children }: Props) {
    const socketsRef = useRef<Map<number, SocketRecord>>(new Map());

    const register = useCallback((socket: SocketRecord) => {
        socketsRef.current.set(socket.id, socket);
    }, []);

    const unregister = useCallback((id: number) => {
        socketsRef.current.delete(id);
    }, []);

    return (
        <SocketContext.Provider
            value={{ sockets: socketsRef.current, register, unregister }}
        >
            {children}
        </SocketContext.Provider>
    );
}
