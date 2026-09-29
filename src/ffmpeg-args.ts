// Pure helpers that turn the UI settings into an FFmpeg argument list.
// No Electron or Node imports here so the logic can be unit-tested.

export const TARGET_FORMATS = ['mp4', 'mkv', 'mov', 'avi', 'webm', 'gif', 'mp3', 'wav', 'flac', 'm4a', 'ogg', 'png', 'jpg', 'ts', 'flv'] as const;
export type TargetFormat = typeof TARGET_FORMATS[number];

export const AUDIO_FORMATS: readonly TargetFormat[] = ['mp3', 'wav', 'flac', 'm4a', 'ogg'];
export const IMAGE_FORMATS: readonly TargetFormat[] = ['png', 'jpg'];

export const RESOLUTIONS = ['original', '1920:1080', '1280:720', '854:480', '640:360'] as const;
export type Resolution = typeof RESOLUTIONS[number];

export const FILTERS = [
    { id: 'none', label: 'Aucun', vf: '' },
    { id: 'grayscale', label: 'Noir & Blanc', vf: 'format=gray' },
    { id: 'sepia', label: 'Sépia', vf: 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131' },
    { id: 'blur', label: 'Flou léger', vf: 'boxblur=1:1' },
    { id: 'bright', label: 'Plus lumineux', vf: 'eq=brightness=0.1' },
] as const;
export type FilterId = typeof FILTERS[number]['id'];

// Video codec (with its options) and audio codec for each container
const VIDEO_CODECS: Partial<Record<TargetFormat, { video: string[]; audio: string[] }>> = {
    mp4: { video: ['-c:v', 'h264_videotoolbox', '-q:v', '60', '-pix_fmt', 'yuv420p'], audio: ['-c:a', 'aac', '-b:a', '192k'] },
    mov: { video: ['-c:v', 'h264_videotoolbox', '-q:v', '60', '-pix_fmt', 'yuv420p'], audio: ['-c:a', 'aac', '-b:a', '192k'] },
    mkv: { video: ['-c:v', 'h264_videotoolbox', '-q:v', '60', '-pix_fmt', 'yuv420p'], audio: ['-c:a', 'aac', '-b:a', '192k'] },
    ts: { video: ['-c:v', 'h264_videotoolbox', '-q:v', '60', '-pix_fmt', 'yuv420p'], audio: ['-c:a', 'aac', '-b:a', '192k'] },
    flv: { video: ['-c:v', 'h264_videotoolbox', '-q:v', '60', '-pix_fmt', 'yuv420p'], audio: ['-c:a', 'aac', '-b:a', '192k'] },
    webm: { video: ['-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-row-mt', '1'], audio: ['-c:a', 'libopus', '-b:a', '128k'] },
    avi: { video: ['-c:v', 'mpeg4', '-q:v', '3'], audio: ['-c:a', 'libmp3lame', '-b:a', '192k'] },
};

const AUDIO_CODECS: Partial<Record<TargetFormat, string[]>> = {
    mp3: ['-c:a', 'libmp3lame', '-b:a', '320k'],
    wav: ['-c:a', 'pcm_s16le'],
    flac: ['-c:a', 'flac'],
    m4a: ['-c:a', 'aac', '-b:a', '256k'],
    ogg: ['-c:a', 'libopus', '-b:a', '160k'],
};

export interface ConversionOptions {
    input: string;
    outputDir: string;
    targetExt: TargetFormat;
    hasVideo: boolean;
    hasAudio: boolean;
    startTime?: string;
    duration?: string;
    resolution?: Resolution;
    filterId?: FilterId;
}

export type BuildResult = { args: string[]; output: string } | { error: string };

// Accepts "90", "90.5", "01:30" or "00:01:30"
const TIME_RE = /^(\d+(\.\d+)?|(\d{1,2}:)?\d{1,2}:\d{1,2}(\.\d+)?)$/;

export const isValidTime = (value: string) => TIME_RE.test(value.trim());

const basename = (p: string) => p.split('/').pop() || p;
const stripExt = (name: string) => name.replace(/\.[^/.]+$/, '');

export const outputPathFor = (input: string, outputDir: string, ext: string) =>
    `${outputDir.replace(/\/+$/, '')}/${stripExt(basename(input))}_converted.${ext}`;

const scaleFilter = (resolution: Resolution): string => {
    if (resolution === 'original') return '';
    const [w, h] = resolution.split(':');
    // Fit inside the box, keep the aspect ratio and even dimensions (required by most encoders)
    return `scale=w=${w}:h=${h}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`;
};

export const buildConversionArgs = (o: ConversionOptions): BuildResult => {
    const start = (o.startTime || '').trim();
    const duration = (o.duration || '').trim();
    if (start && !isValidTime(start)) return { error: `Début invalide : « ${start} »` };
    if (duration && !isValidTime(duration)) return { error: `Durée invalide : « ${duration} »` };

    const isAudioTarget = AUDIO_FORMATS.includes(o.targetExt);
    const isImageTarget = IMAGE_FORMATS.includes(o.targetExt);
    const isGif = o.targetExt === 'gif';

    if ((isImageTarget || isGif) && !o.hasVideo) return { error: `Pas de piste vidéo à convertir en ${o.targetExt.toUpperCase()}` };
    if (isAudioTarget && !o.hasAudio) return { error: `Pas de piste audio à convertir en ${o.targetExt.toUpperCase()}` };

    const output = outputPathFor(o.input, o.outputDir, o.targetExt);
    const args: string[] = [];

    // -ss before -i = fast seek; skipped when starting at 0
    if (start && !/^0*(:0*)*(\.0*)?$/.test(start)) args.push('-ss', start);
    args.push('-i', o.input);
    if (duration) args.push('-t', duration);

    const filter = FILTERS.find(f => f.id === (o.filterId || 'none'))?.vf || '';
    const videoFilters = [filter, scaleFilter(o.resolution || 'original')].filter(Boolean);

    if (isAudioTarget) {
        args.push('-vn', ...AUDIO_CODECS[o.targetExt]!);
    } else if (isImageTarget) {
        if (videoFilters.length) args.push('-vf', videoFilters.join(','));
        args.push('-frames:v', '1', '-an');
        if (o.targetExt === 'jpg') args.push('-q:v', '2');
    } else if (isGif) {
        // Default GIF size unless the user picked one; palette for correct colours
        const gifChain = [filter, scaleFilter(o.resolution && o.resolution !== 'original' ? o.resolution : '640:360'), 'fps=12']
            .filter(Boolean).join(',');
        args.push('-filter_complex', `[0:v]${gifChain},split[a][b];[a]palettegen[p];[b][p]paletteuse`, '-loop', '0', '-an');
    } else {
        const codecs = VIDEO_CODECS[o.targetExt]!;
        if (o.hasVideo) {
            if (videoFilters.length) args.push('-vf', videoFilters.join(','));
            args.push(...codecs.video);
        } else {
            args.push('-vn');
        }
        if (o.hasAudio) args.push(...codecs.audio);
        else args.push('-an');
    }

    args.push(output);
    return { args, output };
};

// Splits an expert-mode command line into arguments, honouring "double" and 'single' quotes
// so that paths with spaces survive. A leading "ffmpeg" is dropped.
export const parseCommandLine = (line: string): string[] => {
    const args: string[] = [];
    let current = '';
    let quote: '"' | "'" | null = null;
    let hasToken = false;

    for (const ch of line.trim()) {
        if (quote) {
            if (ch === quote) quote = null;
            else current += ch;
        } else if (ch === '"' || ch === "'") {
            quote = ch;
            hasToken = true;
        } else if (/\s/.test(ch)) {
            if (hasToken) args.push(current);
            current = '';
            hasToken = false;
        } else {
            current += ch;
            hasToken = true;
        }
    }
    if (hasToken) args.push(current);
    if (args[0] === 'ffmpeg') args.shift();
    return args;
};

// Files produced by a previous run must not be picked up again by a folder batch
export const isConvertedOutput = (path: string) => /_converted\.[^/.]+$/.test(path);
