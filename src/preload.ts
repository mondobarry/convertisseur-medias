import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    runFFmpeg: (args: string[]) => ipcRenderer.invoke('ffmpeg:run', args),
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
    getFileInfo: (path: string) => ipcRenderer.invoke('ffmpeg:probe', path),
    listFiles: (path: string) => ipcRenderer.invoke('folder:listFiles', path),
    onProgress: (callback: (data: { log: string }) => void) => {
        const subscription = (_event: IpcRendererEvent, value: { log: string }) => callback(value);
        ipcRenderer.on('ffmpeg:progress', subscription);
        return () => ipcRenderer.removeListener('ffmpeg:progress', subscription);
    }
});
