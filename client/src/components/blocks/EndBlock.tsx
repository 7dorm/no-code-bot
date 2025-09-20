import {BaseBlock} from "./BaseBlock.tsx";
import type {ComponentChildren} from "preact";
import {Socket} from "../sockets/Socket.tsx";


export class EndBlock extends BaseBlock {

    renderBlock(): ComponentChildren {
        return (
            <>
                <h1>End Block</h1>
                <Socket type={"input"}/>
            </>
        );
    }
}
