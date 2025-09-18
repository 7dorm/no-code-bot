import {BaseBlock} from "./BaseBlock.tsx";
import type {ComponentChildren} from "preact";


export class EndBlock extends BaseBlock {
    renderBlock(): ComponentChildren {
        return (
            <>
                <h1>
                    End Block
                </h1>
            </>
        );
    }
}
