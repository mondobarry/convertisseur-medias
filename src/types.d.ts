export interface IElectronAPI {
    runFFmpeg: (args: string[]) => Promise<{ success: boolean; code?: number; error?: string }>;
    openFile: () => Promise<string | undefined>;
    selectFolder: () => Promise<string | undefined>;
    getFileInfo: (path: string) => Promise<any>;
    listFiles: (path: string) => Promise<string[] | { error: string }>;
    onProgress: (callback: (data: { log: string }) => void) => () => void;
}

declare global {
    interface Window {
        electronAPI: IElectronAPI;
    }
}
