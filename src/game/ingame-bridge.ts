import { IFloNode } from '@/flo-integration/flo-worker.instance';
import logger from "@/logger";
import store from "@/globalState/vuex-store";

const http = window.require("http");
const WebSocket = window.require("ws");
import { EventEmitter } from 'events';
import {EGateway, ICurrentPlayer, IPlayerInstance} from './game.types';

export enum ELauncherMessageType {
    REQUEST_AUTHENTICATION_TOKEN = 'REQUEST_AUTHENTICATION_TOKEN',
    RECEIVED_AUTHENTICATION_TOKEN_FROM_LAUNCHER = 'RECEIVED_AUTHENTICATION_TOKEN_FROM_LAUNCHER',

    CONNECTED = 'CONNECTED',
    DISCONNECTED = 'DISCONNECTED',
    LAUNCHER_VERSION = 'LAUNCHER_VERSION',
    START_GAME = 'START_GAME',
    EXIT_GAME = 'EXIT_GAME',
    FLO_AUTH = 'FLO_AUTH',
    FLO_CONNECTED = 'FLO_CONNECTED',
    FLO_DISCONNECTED = 'FLO_DISCONNECTED',
    FLO_CHECK_BONJOUR = 'FLO_CHECK_BONJOUR',
    FLO_CHECK_BONJOUR_RESULT = 'FLO_CHECK_BONJOUR_RESULT',
    FLO_PING_UPDATE = 'FLO_PING_UPDATE',

    FLO_CREATE_TEST_GAME = 'FLO_CREATE_TEST_GAME',
    FLO_KILL_TEST_GAME = 'FLO_KILL_TEST_GAME',
}

export interface ILauncherGameMessage {
    type: ELauncherMessageType;
    data?: any;
}

export interface IIngameBridgeEvent extends ILauncherGameMessage {
    playerInstance: IPlayerInstance;
}

export class IngameBridge extends EventEmitter {
    private server = http.createServer();
    private wss = new WebSocket.Server({ server: this.server });

    public initialize() {
        this.wss.on("connection", (ws: WebSocket) => {
            const pi = this.createPlayerInstance(ws);
            pi.onmessage = (message: MessageEvent) => {
                logger.info(message);

                try {
                    const parsed = JSON.parse(message.data) as ILauncherGameMessage;
                    const event: IIngameBridgeEvent = {
                        playerInstance: pi,
                        type: parsed.type,
                        data: parsed.data
                    }

                    if(parsed.type === ELauncherMessageType.REQUEST_AUTHENTICATION_TOKEN) {
                        const message: ILauncherGameMessage = {
                            type: ELauncherMessageType.RECEIVED_AUTHENTICATION_TOKEN_FROM_LAUNCHER,
                            data: store.state.w3cToken
                        };
                        pi.sendMessage(message);
                    }

                    this.emit(parsed.type, event);
                }
                catch (e) {
                    logger.error(e)
                }
            };

            pi.onclose = () => {
                this.emit(ELauncherMessageType.DISCONNECTED, pi);
            };

            this.sendLauncherVersion(pi);
        });

        this.server.listen(38123);
    }

    public sendLauncherVersion(playerInstance: IPlayerInstance) {
        const message: ILauncherGameMessage = {
            type: ELauncherMessageType.LAUNCHER_VERSION,
            data: { launcherVersion: store.state.updateHandling.localLauncherVersion }
        };

        playerInstance.sendMessage(message);
    }

    public sendFloConnected(playerInstance: IPlayerInstance, workerVersion: string) {
        const message: ILauncherGameMessage = {
            type: ELauncherMessageType.FLO_CONNECTED,
            data: {
                workerVersion
            }
        };

        playerInstance.sendMessage(message);
    }

    public sendFloDisconnected(playerInstance: IPlayerInstance) {
        const message: ILauncherGameMessage = {
            type: ELauncherMessageType.FLO_DISCONNECTED
        };

        playerInstance.sendMessage(message);
    }

    public sendFloBonjourCheckResult(playerInstance: IPlayerInstance, isRunning: boolean) {
        const message: ILauncherGameMessage = {
            type: ELauncherMessageType.FLO_CHECK_BONJOUR_RESULT,
            data: { isRunning }
        };

        playerInstance.sendMessage(message);
    }

    public sendPingUpdates(playerInstance: IPlayerInstance, nodePings: IFloNode[]) {
        const message: ILauncherGameMessage = {
            type: ELauncherMessageType.FLO_PING_UPDATE,
            data: nodePings
        };

        playerInstance.sendMessage(message);
    }

    private createPlayerInstance(ws: WebSocket) {
        //tbd get this from token/identity
        const player = {
            battleTag: "modmoto#2809",
            toonName: "modmoto#2809",
            gateway: EGateway.Europe,
            gatewayPing: 30,
            token: "test",
            country: "DE",
        } as ICurrentPlayer;

        const pi = ws as IPlayerInstance;

        pi.player = player as ICurrentPlayer;

        pi.isDisconnected = () => {
            return pi.readyState == pi.CLOSING || pi.readyState == pi.CLOSED;
        };

        pi.sendMessage = (message: ILauncherGameMessage) => {
            pi.send(JSON.stringify(message));
        };

        return pi;
    }
}

export const ingameBridge = new IngameBridge();
