import { describe, expect, it } from 'vitest';
import { candidatePaths, locateBinary } from './ffmpeg-locator';

describe('candidatePaths', () => {
    it('tries the bundled binary for the current architecture first', () => {
        expect(candidatePaths('/App/Resources/binaries', 'arm64', 'ffmpeg')).toEqual([
            '/App/Resources/binaries/arm64/ffmpeg',
            '/opt/homebrew/bin/ffmpeg',
            '/usr/local/bin/ffmpeg',
        ]);
        expect(candidatePaths('/b', 'x64', 'ffprobe')[0]).toBe('/b/x64/ffprobe');
    });
});

describe('locateBinary', () => {
    const candidates = ['/bundled/ffmpeg', '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'];

    it('keeps the bundled binary when it works', () => {
        expect(locateBinary(candidates, () => true)).toBe('/bundled/ffmpeg');
    });

    it('falls back to Homebrew when the bundled binary is broken', () => {
        expect(locateBinary(candidates, p => p !== '/bundled/ffmpeg')).toBe('/opt/homebrew/bin/ffmpeg');
    });

    it('returns null when nothing runs', () => {
        expect(locateBinary(candidates, () => false)).toBeNull();
    });
});
