import './app.css'
import {StartBlock} from "./components/blocks/StartBlock.tsx";
import {EndBlock} from "./components/blocks/EndBlock.tsx";

export function App() {

    return (
        <>
            <StartBlock saveLayout={() => {}}/>
            <EndBlock saveLayout={() => {}}/>
        </>
    )
}
