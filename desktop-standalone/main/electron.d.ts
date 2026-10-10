declare module 'electron' {
  export class BrowserWindow {
    constructor(options?: any);
    loadURL(url: string): Promise<void>;
    loadFile(filePath: string): Promise<void>;
    on(event: string, listener: (...args: any[]) => void): this;
    minimize(): void;
    maximize(): void;
    unmaximize(): void;
    isMaximized(): boolean;
    close(): void;
    webContents: any;
    static getAllWindows(): BrowserWindow[];
  }

  export const app: {
    whenReady(): Promise<void>;
    on(event: string, listener: (...args: any[]) => void): void;
    quit(): void;
    getPath(name: string): string;
  };

  export const ipcMain: {
    handle(channel: string, listener: (event: any, ...args: any[]) => any): void;
    on(channel: string, listener: (event: any, ...args: any[]) => void): void;
  };

  export const ipcRenderer: {
    invoke(channel: string, ...args: any[]): Promise<any>;
    send(channel: string, ...args: any[]): void;
  };

  export const contextBridge: {
    exposeInMainWorld(apiKey: string, api: any): void;
  };
}
