import {Component, createRef} from "preact";
import {SocketContext} from "./SocketContext";


export class Socket extends Component<{ type: "input" | "output" }> {
    static contextType = SocketContext;
    id = crypto.randomUUID();
    ref = createRef<HTMLDivElement>();
    startPos = { x: 0, y: 0 };

    state = { connecting: false, preview: { x: 0, y: 0 } };

    componentDidMount() {
        this.context.register({
            id: this.id,
            type: this.props.type,
            el: this.ref.current,
        });
    }
    componentWillUnmount() {
        this.context.unregister(this.id);
        window.removeEventListener("mousemove", this.onMouseMove);
        window.removeEventListener("mouseup", this.onMouseUp);
    }

    onMouseDown = () => {
        const r = this.ref.current!.getBoundingClientRect();
        this.startPos = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        this.setState({ connecting: true, preview: this.startPos });
        window.addEventListener("mousemove", this.onMouseMove);
        window.addEventListener("mouseup", this.onMouseUp);
    };

    onMouseMove = (e: MouseEvent) => {
        if (!this.state.connecting) return;
        this.setState({ preview: { x: e.clientX, y: e.clientY } });
    };

    onMouseUp = (e: MouseEvent) => {
        window.removeEventListener("mousemove", this.onMouseMove);
        window.removeEventListener("mouseup", this.onMouseUp);
        if (!this.state.connecting) return;

        this.setState({ connecting: false });

        const targetEl = (e.target as HTMLElement).closest(".socket") as HTMLDivElement | null;
        if (!targetEl || targetEl.id === this.id) return;

        const myRecord   = this.context.sockets.get(this.id);
        const targetRec  = this.context.sockets.get(targetEl.id);

        // allow only output → input (and prevent input → input, output → output)
        if (
            myRecord &&
            targetRec &&
            myRecord.type !== targetRec.type
        ) {
            myRecord.connectedTo = targetRec.id;
            this.context.register({ ...myRecord });
        } else {
            // optional: show error or just ignore
            console.warn("Invalid connection attempt");
        }
    };

    render() {
        return (
            <>
                <div
                    id={this.id}
                    ref={this.ref}
                    class={`socket ${this.props.type}`}
                    onMouseDown={this.onMouseDown}
                    style={
                    {
                        // position: "absolute",

                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        background: this.props.type === "input" ? "green" : "blue",
                        cursor: "crosshair",
                    }}
                />
            </>
        );
    }
}
