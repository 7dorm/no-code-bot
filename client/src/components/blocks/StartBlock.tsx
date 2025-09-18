import {BaseBlock} from "./BaseBlock.tsx";
import type {ComponentChildren} from "preact";
import {Socket} from "../nodes/Socket.tsx";


export class StartBlock extends BaseBlock {

    renderBlock(): ComponentChildren {
        return (
            <>
                <h1>
                    Start Block
                </h1>
                <div style={{
                    position: "relative"
                }}>
                    <div style={{
                        position: "relative"
                    }}>
                        <Socket type={"output"}/>
                    </div>
                </div>
            </>
        );
    }
}
