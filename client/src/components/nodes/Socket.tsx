import {Component, createRef} from "preact";
import {SocketContext} from "./SocketContext";
import type {ContextType} from "preact";
import {v4 as uuidv4} from "uuid";

export class Socket extends Component<{ type: "input" | "output" }> {
    static contextType = SocketContext;
    declare context: ContextType<typeof SocketContext>;

    logic: SocketInput | SocketOutput;
    ref = createRef<HTMLDivElement>();

    state = {
        connecting: false,
        canBeConnected: false,
        connectToId: '',
        id: uuidv4(), // or use incremental id
        line: null
    };

    constructor(props: any) {
        super(props);
        this.logic =
            props.type === "input" ? new SocketInput() : new SocketOutput();
    }

    componentDidMount() {
        window.addEventListener("mousemove", this.onMouseMove);
        window.addEventListener("mouseup", this.onMouseUp);

        // register in provider
        this.context.register({
            id: this.state.id,
            type: this.logic.type as "input" | "output",
            el: this.ref.current,
        });
    }

    componentWillUnmount() {
        window.removeEventListener("mousemove", this.onMouseMove);
        window.removeEventListener("mouseup", this.onMouseUp);
        this.context.unregister(this.state.id);
    }

    // componentDidUpdate(previousProps: Readonly<any>, previousState: Readonly<any>, snapshot: any) {
    //
    // }

    onMouseMove = (e: MouseEvent) => {
        if (!this.state.connecting) return;
        const el = e.target as HTMLElement;
        const classes = el.className?.split(" ") ?? [];
        const otherId = el.id as string;
        const [_, socketType] = classes;
        if (
            (socketType === "input" && this.logic.type === "output") ||
            (socketType === "output" && this.logic.type === "input")
        ) {
            this.setState({canBeConnected: true, connectToId: otherId});
        }
    };

    onMouseUp = () => {
        if (!this.state.connecting) return;
        this.setState({connecting: false, canBeConnected: false});
        this.updateConnection();
    };

    updateConnection = () => {
        const me = document.getElementById(this.state.id)?.getBoundingClientRect();
        const other = document.getElementById(this.state.connectToId)?.getBoundingClientRect();
        // @ts-ignore
        const myPos = {x: me?.x + me?.width / 2, y: me?.y + me?.height / 2};
        // @ts-ignore
        const otherPos = {x: other?.x + other?.width / 2, y: other?.y + other?.height / 2};

        if (!isNaN(otherPos.x) && !isNaN(otherPos.y)) {
            // console.log(this.ref.current?.className, myPos, "\nOther", otherPos);
            this.setState({
                line: <svg style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                }}>
                    <line
                        key={`${this.state.id.replace("-", "")}-${this.state.connectToId.replace("-", "")}`}
                        x1={myPos.x}
                        y1={myPos.y}
                        x2={otherPos.x}
                        y2={otherPos.y}
                        stroke="blue"
                        stroke-width="2"
                    />
                </svg>
            });
        }
    }

    onMouseDown = () => {
        this.setState({connecting: true});
    };

    render() {
        console.log(this.state.line);
        return (<>
                <div
                    className={`socket ${this.logic.type}`}
                    id={this.state.id}
                    ref={this.ref}
                    onMouseDown={this.onMouseDown}
                    style={{
                        background: this.logic.color,
                        borderRadius: "100%",
                        width: "40px",
                        height: "40px",
                    }}
                />
                {this.state.line}
            </>

        );
    }
}

class SocketInput {
    color = "green";
    type = "input";
}

class SocketOutput {
    color = "blue";
    type = "output";
}
