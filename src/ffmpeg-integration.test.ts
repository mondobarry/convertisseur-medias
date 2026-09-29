// Runs real conversions for every target format.
// Only enabled when FFMPEG_PATH points to an ffmpeg binary (ffprobe must sit next to it):
//   FFMPEG_PATH=binaries/arm64/ffmpeg npm test
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildConversionArgs, TARGET_FORMATS, AUDIO_FORMATS, IMAGE_FORMATS } from './ffmpeg-args';

const ffmpeg = process.env.FFMPEG_PATH;
const ffprobe = ffmpeg && path.join(path.dirname(ffmpeg), 'ffprobe');

const probe = (file: string) =>
    JSON.parse(execFileSync(ffprobe!, ['-v', 'quiet', '-print_format', 'json', '-show_streams', file]).toString());

describe.skipIf(!ffmpeg)('real ffmpeg conversions', () => {
    let dir: string;
    let source: string;

    beforeAll(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'convertisseur-'));
        source = path.join(dir, 'source clip.mp4');
        // 4 s test pattern 1280x720 with a sine tone
        execFileSync(ffmpeg!, ['-nostdin', '-y', '-v', 'error',
            '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=25', '-f', 'lavfi', '-i', 'sine=frequency=440',
            '-t', '4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', source]);
    });

    it.each(TARGET_FORMATS)('converts to %s with trim, filter and resize', (ext) => {
        const built = buildConversionArgs({
            input: source, outputDir: dir, targetExt: ext, hasVideo: true, hasAudio: true,
            startTime: '1', duration: '2', resolution: '640:360', filterId: 'sepia',
        });
        if ('error' in built) throw new Error(built.error);

        execFileSync(ffmpeg!, ['-nostdin', '-y', '-v', 'error', ...built.args]);

        expect(fs.statSync(built.output).size).toBeGreaterThan(0);
        const streams = probe(built.output).streams as any[];
        const video = streams.find(s => s.codec_type === 'video');
        if (AUDIO_FORMATS.includes(ext)) {
            expect(video).toBeUndefined();
            expect(streams.some(s => s.codec_type === 'audio')).toBe(true);
        } else {
            expect([video.width, video.height]).toEqual([640, 360]);
            if (!IMAGE_FORMATS.includes(ext) && ext !== 'gif') {
                expect(streams.some(s => s.codec_type === 'audio')).toBe(true);
                expect(Number(probe(built.output).streams[0].duration ?? 2)).toBeLessThan(3);
            }
        }
    }, 60_000);
});
