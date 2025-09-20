// SocketProvider.tsx
import { useState, useCallback } from "preact/hooks";
import { SocketContext, type SocketRecord } from "./SocketContext";
import type { ComponentChildren } from "preact";

type Props = { children: ComponentChildren };

export function SocketProvider({ children }: Props) {
    const [sockets, setSockets] = useState<Map<string, SocketRecord>>(new Map());

    const register = useCallback((socket: SocketRecord) => {
        setSockets(prev => {
            const next = new Map(prev);
            next.set(socket.id, socket);
            return next;
        });
    }, []);

    const unregister = useCallback((id: string) => {
        setSockets(prev => {
            const next = new Map(prev);
            next.delete(id);
            return next;
        });
    }, []);

    return (
        <SocketContext.Provider value={{ sockets, register, unregister }}>
            {children}
        </SocketContext.Provider>
    );
}
