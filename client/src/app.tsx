import './app.css'
import {StartBlock} from "./components/blocks/StartBlock.tsx";
import {EndBlock} from "./components/blocks/EndBlock.tsx";
// import {Socket} from "./components/nodes/Socket.tsx";
import {SocketProvider} from "./components/nodes/SocketProvider.tsx";

export function App() {
    return (
        <SocketProvider>
            <StartBlock saveLayout={() => {}}/>
            <EndBlock saveLayout={() => {}}/>
        </SocketProvider>

        );

}
