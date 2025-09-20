import { createContext } from "preact";

export type SocketRecord = {
    id: string;
    type: "input" | "output";
    el: HTMLDivElement | null;
    connectedTo: string;
};

export type SocketRegistry = {
    sockets: Map<string, SocketRecord>;
    register: (socket: SocketRecord) => void;
    unregister: (id: string) => void;
};

export const SocketContext = createContext<SocketRegistry>({
    sockets: new Map(),
    register: () => {},
    unregister: () => {},
});
