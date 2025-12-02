// BaseBlock.tsx
import { Component } from "preact";

export type BaseBlockProps = {
    id: string;
    x?: number;
    y?: number;
    title?: string;
    disableInput?: boolean;
    disableOutput?: boolean;
};

export type BaseBlockState = {
    x: number;
    y: number;
    dragging: boolean;
    offsetX: number;
    offsetY: number;
    showEditPopup: boolean;
};

export abstract class BaseBlock<
    P extends BaseBlockProps = BaseBlockProps,
    S extends BaseBlockState = BaseBlockState
> extends Component<P, S> {
    constructor(props: P) {
        super(props);
        this.state = {
            x: props.x ?? 200,
            y: props.y ?? 200,
            dragging: false,
            offsetX: 0,
            offsetY: 0,
            showEditPopup: false,
        } as S;
    }

    protected abstract renderTitle(): preact.ComponentChildren;
    protected abstract renderBody(): preact.ComponentChildren;
    protected abstract renderEditPopup(): preact.ComponentChildren;

    handleMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        this.setState({
            dragging: true,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top,
        });
        window.addEventListener("mousemove", this.handleMouseMove);
        window.addEventListener("mouseup", this.handleMouseUp);
    };

    handleMouseMove = (e: MouseEvent) => {
        if (!this.state.dragging) return;
        const x = e.clientX - this.state.offsetX;
        const y = e.clientY - this.state.offsetY;
        this.setState({ x, y });
    };

    handleMouseUp = () => {
        this.setState({ dragging: false });
        window.removeEventListener("mousemove", this.handleMouseMove);
        window.removeEventListener("mouseup", this.handleMouseUp);
    };

    render() {
        const { x, y, dragging } = this.state;

        return (
            <div
                class={`absolute select-none border-2 rounded-xl shadow-lg overflow-hidden transition-transform duration-100 ${
                    dragging
                        ? "opacity-80 cursor-grabbing scale-[1.03]"
                        : "cursor-grab hover:scale-[1.02]"
                }`}
                style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    width: "180px",
                    minHeight: "100px",
                    background: "linear-gradient(145deg, #f0f0f0, #dcdcdc)",
                    borderColor: "#b0b0b0",
                }}
                onMouseDown={this.handleMouseDown}
            >
                <div class="bg-gray-200 border-b border-gray-300 p-2 text-center font-semibold text-gray-700">
                    {this.renderTitle()}
                </div>
                <div class="p-3 relative text-gray-800 text-sm">{this.renderBody()}</div>
            </div>
        );
    }
}
