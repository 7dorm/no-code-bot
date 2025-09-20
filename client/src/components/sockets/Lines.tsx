// Lines.tsx
import { Component, type ContextType } from "preact";
import { SocketContext } from "./SocketContext";
import {type JSX} from "preact";

export class Lines extends Component {
    static contextType = SocketContext;
    declare context: ContextType<typeof SocketContext>;

    handleSocketMoved = () => this.forceUpdate();

    componentDidMount() {
        window.addEventListener("socket-moved", this.handleSocketMoved);
    }

    componentWillUnmount() {
        window.removeEventListener("socket-moved", this.handleSocketMoved);
    }


    render() {
        const { sockets } = this.context;

        const lines: JSX.Element[] = [];

        sockets.forEach((sock) => {
            if (sock.connectedTo) {
                const target = sockets.get(sock.connectedTo);
                if (!target?.el || !sock.el) return;

                const a = sock.el.getBoundingClientRect();
                const b = target.el.getBoundingClientRect();

                const x1 = a.left + a.width / 2;
                const y1 = a.top + a.height / 2;
                const x2 = b.left + b.width / 2;
                const y2 = b.top + b.height / 2;

                lines.push(
                    <line key={sock.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke="black" />
                );
            }
        });

        return (
            <svg
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                }}
            >
                {lines}
            </svg>
        );
    }
}
