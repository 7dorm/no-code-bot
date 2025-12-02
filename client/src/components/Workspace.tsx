import {useState} from "preact/hooks";
import {TextBlock} from "./blocks/TextBlock.tsx";

export const Workspace = () => {
    const [blocks, setBlocks] = useState([
        { id: "a", x: 200, y: 100 },
        { id: "b", x: 400, y: 250 },
    ]);

    const handleMove = (id: string, x: number, y: number) => {
        setBlocks(bs => bs.map(b => (b.id === id ? { ...b, x, y } : b)));
    };

    return (
        <div class="relative w-full h-screen bg-gray-100 overflow-hidden">
            {blocks.map(b => (
                <TextBlock key={b.id} {...b} onMove={handleMove} />
            ))}
        </div>
    );
};
