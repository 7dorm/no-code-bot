import {Component, createRef} from "preact";
import type {ComponentProps, Context, ComponentChildren} from "preact";
import "../../styles/components/blocks/BaseBlock.css";

// @ts-ignore
enum CursorState {
    Grab = "grab",
    Grabbing = "grabbing",
}

export abstract class BaseBlock extends Component<{
    saveLayout: (state: any) => void,
}> {
    static displayName = "BaseBlock";

    position = createRef();
    size = createRef();
    private componentRef: any;

    constructor(props?: ComponentProps<any>, context?: Context<any>) {
        super(props, context);
        this.position.current = {x: 0, y: 0};
        this.size.current = {w: 500, h: 300};
        this.componentRef = createRef();
    }

    state = {
        dragging: false,
        offset: [0, 0],
        cursor: CursorState.Grab,
        over: false,
        resize: false,
        pos_from: [0, 0],
        selected: false,
        _class: ["block"],
        style: {},
        z: 0
    };

    // @ts-ignore
    renderBlock(parent_size?: { w: number, h: number }): ComponentChildren {
        return <h1 style={{
            textAlign: "center",
            fontSize: 40,
        }}>
            Base render on the block
        </h1>;
    }

    // addClass(class_name: string) {
    //     this.setState({_class: [...this.state._class, class_name]});
    // }
    //
    // addStyle(style: { key: any, value: any }) {
    //     this.setState({style: this.state.style && style});
    // }
    //
    // setSize(size: { w: number, h: number }) {
    //     this.size.current = size;
    // }

    componentDidMount() {
        window.addEventListener("mousemove", this.onMouseMove);
        window.addEventListener("mouseup", this.onMouseUp);
        window.addEventListener("mouseover", this.onMouseOver);
    }

    componentWillUnmount() {
        window.removeEventListener("mousemove", this.onMouseMove);
        window.removeEventListener("mouseup", this.onMouseUp);
        window.removeEventListener("mouseover", this.onMouseOver);
    }

    componentDidUpdate() {
        this.props.saveLayout({
            position: this.position.current,
            size: this.size.current,
        });
    }

    onMouseDown = (e: MouseEvent) => {
        if (!this.state.over) return;
        e.stopPropagation();
        const rect = this.componentRef.current.getBoundingClientRect();
        if (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
        ) {
            this.select();
            this.setState({
                dragging: true,
                offset: [e.clientX - rect.left, e.clientY - rect.top],
                cursor: CursorState.Grabbing,
                z: 1
            });
        }
    };

    onMouseMove = (e: MouseEvent) => {
        if (this.state.over) {
            let posx = e.clientX - this.state.offset[0];
            let posy = e.clientY - this.state.offset[1];

            if (!this.state.dragging) return;

            this.position.current.x = posx;
            this.position.current.y = posy;

            this.setState({
                dragging: true
            });
        }
        window.dispatchEvent(new Event("socket-moved"));
    };

    onMouseUp = () => {
        this.setState({
            dragging: false,
            cursor: CursorState.Grab,
            z: 0,
        });

        let {x, y} = this.position.current;
        let {w, h} = this.size.current;

        this.position.current = {x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10}
        this.size.current = {w: Math.round(w / 10) * 10, h: Math.round(h / 10) * 10}
    };

    onMouseOver = (e: MouseEvent) => {
        const t = e.target as Node;
        if (t.nodeName !== "H1" && e.target === this.componentRef.current) {
            this.setState({
                over: true,
            })
        } else {
            this.setState({
                over: false,
            })
        }
    }

    select = () => {
        this.setState({selected: true});
    }

    render() {
        return (
            <>
                <div
                    ref={this.componentRef}
                    className={this.state._class.join(" ")}
                    style={
                        this.state.style &&
                        {
                            cursor: this.state.cursor,
                            width: this.size.current.w,
                            height: this.size.current.h,
                            top: this.position.current.y,
                            left: this.position.current.x,
                            zIndex: this.state.z
                        }
                    }
                    onMouseDown={this.onMouseDown}>
                    {this.renderBlock(this.size.current)}
                </div>
            </>
        )
    }
}
