import './app.css'
import {StartBlock} from "./components/blocks/StartBlock.tsx";
import {EndBlock} from "./components/blocks/EndBlock.tsx";
// import {Socket} from "./components/nodes/Socket.tsx";
import {SocketProvider} from "./components/sockets/SocketProvider.tsx";
import {Lines} from "./components/sockets/Lines.tsx";
import {PrintBlock} from "./components/blocks/PrintBlock.tsx";

export function App() {
    return (
        <SocketProvider>
            <StartBlock saveLayout={() => {}}/>
            <PrintBlock saveLayout={() => {}}/>
            <EndBlock saveLayout={() => {}}/>
            <Lines/>
        </SocketProvider>
        );

}
