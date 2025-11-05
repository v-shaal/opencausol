declare module "yjs" {
  export class Doc {
    constructor();
    getMap<T = any>(name: string): any;
    getArray<T = any>(name: string): any;
    on(event: string, listener: (...args: any[]) => void): void;
    once(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener: (...args: any[]) => void): void;
    destroy(): void;
  }
  export type UpdateEncoderV2 = any;
}

declare module "y-websocket" {
  import type { Doc } from "yjs";
  export class WebsocketProvider {
    constructor(url: string, roomName: string, doc: Doc, options?: Record<string, any>);
    on(event: string, listener: (...args: any[]) => void): void;
    once(event: string, listener: (...args: any[]) => void): void;
    destroy(): void;
  }
}
