import {BaseBlock} from "./BaseBlock.tsx";
import type {ComponentChildren} from "preact";
import {Socket} from "../sockets/Socket.tsx";

export class PrintBlock extends BaseBlock {

    renderBlock(): ComponentChildren {
        return (
            <div>
                <h1 style={{textAlign: "center"}}>Send to user</h1>
                <Socket type="input"/>
                <Socket type="output"/>
            </div>
        );
    }
}
