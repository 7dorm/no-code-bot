import { createContext } from "preact";

export type SocketRecord = {
    id: string;
    type: "input" | "output";
    el: HTMLDivElement | null;
};

export type SocketRegistry = {
    sockets: Map<number, SocketRecord>;
    register: (socket: SocketRecord) => void;
    unregister: (id: string) => void;
};

export const SocketContext = createContext<SocketRegistry>({
    sockets: new Map(),
    register: () => {},
    unregister: () => {},
});
