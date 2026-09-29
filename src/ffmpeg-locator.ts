// Picks the ffmpeg/ffprobe binary to use. The bundled one comes first; if it is
// missing or cannot run (e.g. a build linked against a Homebrew version that has
// since been upgraded), fall back to a system install that is kept up to date.

export type BinaryName = 'ffmpeg' | 'ffprobe';

export const SYSTEM_BIN_DIRS = ['/opt/homebrew/bin', '/usr/local/bin'];

export const candidatePaths = (bundledDir: string, arch: string, bin: BinaryName): string[] => [
    `${bundledDir}/${arch === 'arm64' ? 'arm64' : 'x64'}/${bin}`,
    ...SYSTEM_BIN_DIRS.map(dir => `${dir}/${bin}`),
];

export const locateBinary = (candidates: string[], works: (path: string) => boolean): string | null =>
    candidates.find(works) ?? null;
