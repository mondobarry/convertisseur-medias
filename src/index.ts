import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { BinaryName, candidatePaths, locateBinary } from './ffmpeg-locator';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

const binaryCache = new Map<BinaryName, string>();

// Bundled binary first, then Homebrew / /usr/local if the bundled one cannot run
const getBinaryPath = (binName: BinaryName): string => {
  const cached = binaryCache.get(binName);
  if (cached) return cached;

  const bundledDir = app.isPackaged
    ? path.join(process.resourcesPath, 'binaries')
    : path.join(app.getAppPath(), 'binaries');
  const candidates = candidatePaths(bundledDir, os.arch(), binName);
  const works = (p: string) =>
    fs.existsSync(p) && spawnSync(p, ['-hide_banner', '-version'], { timeout: 10_000 }).status === 0;

  const found = locateBinary(candidates, works);
  if (!found) return candidates[0]; // spawn will fail and the error is shown in the UI
  if (found !== candidates[0]) console.warn(`Bundled ${binName} unusable, using ${found}`);
  binaryCache.set(binName, found);
  return found;
};

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    height: 800,
    width: 1200,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
};

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Médias (Vidéo & Audio)', extensions: ['mp4', 'mkv', 'mov', 'avi', 'mp3', 'wav', 'flac', 'webm', 'png', 'jpg', 'jpeg', 'gif', 'flv', 'ts', 'm4a', 'ogg', 'opus'] },
      { name: 'Tous les fichiers', extensions: ['*'] }
    ]
  });
  return result.filePaths[0];
});

ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});

ipcMain.handle('ffmpeg:probe', async (event, filePath: string) => {
  const ffprobePath = getBinaryPath('ffprobe');
  const args = [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath
  ];

  return new Promise((resolve) => {
    let stdout = '';
    const child = spawn(ffprobePath, args);
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.on('close', (code) => {
      try {
        if (code === 0) resolve(JSON.parse(stdout));
        else resolve({ error: `ffprobe exited with code ${code}` });
      } catch (e) {
        resolve({ error: `Failed to parse ffprobe output: ${(e as Error).message}` });
      }
    });
    child.on('error', (err) => {
      resolve({ error: `ffprobe spawn error: ${err.message}` });
    });
  });
});

ipcMain.handle('ffmpeg:run', async (event: Electron.IpcMainInvokeEvent, args: string[]) => {
  const ffmpegPath = getBinaryPath('ffmpeg');
  // -nostdin prevents hangs, -y overwrites without prompting; both must precede the output
  const finalArgs = ['-nostdin', '-y', ...args.filter(a => a !== '-y' && a !== '-nostdin')];

  const child = spawn(ffmpegPath, finalArgs);

  child.stderr.on('data', (data) => {
    const output = data.toString();
    event.sender.send('ffmpeg:progress', { log: output });
  });

  return new Promise((resolve) => {
    child.on('close', (code) => {
      if (code === 0) resolve({ success: true });
      else resolve({ success: false, code });
    });
    child.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
});

ipcMain.handle('folder:listFiles', async (event, folderPath: string) => {
  const mediaExts = new Set([
    '.mp4', '.mkv', '.mov', '.avi', '.mp3', '.m4a', '.wav', '.flac', '.ts', '.gif',
    '.webm', '.flv', '.m4v', '.wmv', '.mpg', '.mpeg', '.m2ts', '.mts', '.3gp', '.ogg',
    '.m4b', '.mjp', '.m4r', '.opus', '.aac', '.ac3', '.aiff', '.amr'
  ]);

  const getAllFiles = (dir: string, fileList: string[] = []) => {
    try {
      if (!fs.existsSync(dir)) return fileList;
      const files = fs.readdirSync(dir);
      files.forEach((file: string) => {
        // Hidden files, including macOS "._" resource forks on network shares
        if (file.startsWith('.')) return;
        const filePath = path.join(dir, file);
        const stat = fs.lstatSync(filePath);
        if (stat.isDirectory()) {
          getAllFiles(filePath, fileList);
        } else {
          const ext = path.extname(file).toLowerCase();
          if (mediaExts.has(ext)) {
            fileList.push(filePath);
          }
        }
      });
    } catch (err) {
      console.error(`Error scanning ${dir}:`, err);
    }
    return fileList;
  };

  try {
    return getAllFiles(folderPath);
  } catch (err) {
    return { error: (err as Error).message };
  }
});

app.on('ready', createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
