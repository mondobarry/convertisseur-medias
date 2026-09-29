import { describe, expect, it } from 'vitest';
import { buildConversionArgs, isConvertedOutput, isValidTime, outputPathFor, parseCommandLine, ConversionOptions } from './ffmpeg-args';

const base: ConversionOptions = {
    input: '/Films/Mes vacances.mov',
    outputDir: '/Sortie',
    targetExt: 'mp4',
    hasVideo: true,
    hasAudio: true,
};

const argsOf = (o: Partial<ConversionOptions>) => {
    const r = buildConversionArgs({ ...base, ...o });
    if ('error' in r) throw new Error(r.error);
    return r.args;
};

describe('buildConversionArgs', () => {
    it('converts video to MP4 with H.264 + AAC', () => {
        expect(argsOf({})).toEqual([
            '-i', '/Films/Mes vacances.mov',
            '-c:v', 'h264_videotoolbox', '-q:v', '60', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '192k',
            '/Sortie/Mes vacances_converted.mp4',
        ]);
    });

    it('uses VP9 + Opus for WebM', () => {
        const args = argsOf({ targetExt: 'webm' });
        expect(args).toContain('libvpx-vp9');
        expect(args).toContain('libopus');
    });

    it('drops the video stream for audio targets', () => {
        expect(argsOf({ targetExt: 'm4a' })).toEqual(['-i', base.input, '-vn', '-c:a', 'aac', '-b:a', '256k', '/Sortie/Mes vacances_converted.m4a']);
        expect(argsOf({ targetExt: 'ogg' })).toContain('libopus');
    });

    it('applies trim, filter and resolution together', () => {
        const args = argsOf({ startTime: '00:00:10', duration: '30', filterId: 'grayscale', resolution: '1280:720' });
        expect(args.slice(0, 6)).toEqual(['-ss', '00:00:10', '-i', base.input, '-t', '30']);
        const vf = args[args.indexOf('-vf') + 1];
        expect(vf).toMatch(/^format=gray,scale=w=1280:h=720:force_original_aspect_ratio=decrease/);
    });

    it('does not seek when the start time is zero', () => {
        expect(argsOf({ startTime: '00:00:00' })[0]).toBe('-i');
    });

    it('extracts a single frame for image targets', () => {
        const args = argsOf({ targetExt: 'jpg', startTime: '5' });
        expect(args).toEqual(['-ss', '5', '-i', base.input, '-frames:v', '1', '-an', '-q:v', '2', '/Sortie/Mes vacances_converted.jpg']);
    });

    it('builds a palette-based GIF with a default size', () => {
        const args = argsOf({ targetExt: 'gif' });
        const graph = args[args.indexOf('-filter_complex') + 1];
        expect(graph).toContain('scale=w=640:h=360');
        expect(graph).toContain('palettegen');
        expect(args).toContain('-an');
    });

    it('keeps audio-only sources audio-only in video containers', () => {
        const args = argsOf({ targetExt: 'mp4', hasVideo: false });
        expect(args).toContain('-vn');
        expect(args).not.toContain('h264_videotoolbox');
    });

    it('refuses impossible conversions', () => {
        expect(buildConversionArgs({ ...base, hasVideo: false, targetExt: 'png' })).toHaveProperty('error');
        expect(buildConversionArgs({ ...base, hasAudio: false, targetExt: 'mp3' })).toHaveProperty('error');
        expect(buildConversionArgs({ ...base, startTime: 'dix secondes' })).toHaveProperty('error');
    });
});

describe('helpers', () => {
    it('validates time values', () => {
        for (const ok of ['30', '12.5', '01:30', '00:01:30', '1:02:03.5']) expect(isValidTime(ok)).toBe(true);
        for (const bad of ['', 'abc', '1:2:3:4', '-5']) expect(isValidTime(bad)).toBe(false);
    });

    it('builds the output path', () => {
        expect(outputPathFor('/a/b/clip.final.mkv', '/out/', 'mp3')).toBe('/out/clip.final_converted.mp3');
    });

    it('recognises previous outputs', () => {
        expect(isConvertedOutput('/x/film_converted.mp4')).toBe(true);
        expect(isConvertedOutput('/x/film.mp4')).toBe(false);
    });

    it('parses expert command lines with quotes', () => {
        expect(parseCommandLine('ffmpeg -i "/Mes Vidéos/film 1.mov" -vf \'scale=640:-2\' out.mp4')).toEqual([
            '-i', '/Mes Vidéos/film 1.mov', '-vf', 'scale=640:-2', 'out.mp4',
        ]);
        expect(parseCommandLine('  -i  a.mp4   b.mp3 ')).toEqual(['-i', 'a.mp4', 'b.mp3']);
        expect(parseCommandLine('-metadata title=""')).toEqual(['-metadata', 'title=']);
    });
});
