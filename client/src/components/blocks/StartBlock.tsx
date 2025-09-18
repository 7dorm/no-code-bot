import {BaseBlock} from "./BaseBlock.tsx";
import type {ComponentChildren} from "preact";


export class StartBlock extends BaseBlock {
    renderBlock(): ComponentChildren {
        return (
            <>
                <h1>
                    Start Block
                </h1>
            </>
        );
    }
}
