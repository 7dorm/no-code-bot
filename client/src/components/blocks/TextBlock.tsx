// TextBlock.tsx
import { BaseBlock, type BaseBlockProps, type BaseBlockState } from "./BaseBlock";

interface TextBlockProps extends BaseBlockProps {
    initialText?: string;
}

interface TextBlockState extends BaseBlockState {
    text: string;
}

export class TextBlock extends BaseBlock<TextBlockProps, TextBlockState> {
    constructor(props: TextBlockProps) {
        super(props);
        this.state = {
            ...this.state,
            text: props.initialText || "Default text",
        };
    }

    protected renderTitle() {
        return "🧱 Text Block";
    }

    protected renderBody() {
        return <div>{this.state.text}</div>;
    }

    protected renderEditPopup() {
        const handleChange = (e: any) => {
            this.setState({ text: e.target.value });
        };
        return (
            <div class="flex flex-col gap-2">
                <label class="text-sm text-gray-600">Block text:</label>
                <input
                    class="border rounded-md p-2 w-full"
                    type="text"
                    value={this.state.text}
                    onInput={handleChange}
                />
                <button
                    class="mt-2 bg-blue-500 text-white rounded-md py-1 hover:bg-blue-600"
                    onClick={() => this.setState({ showEditPopup: false })}
                >
                    Save
                </button>
            </div>
        );
    }
}
