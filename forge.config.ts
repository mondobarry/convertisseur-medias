import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // ASCII file names: a DMG copy stores "é" decomposed (NFD) while Electron expects the
    // composed form, which crashes the app at launch. The accented name is kept for display.
    name: 'Convertisseur Medias',
    executableName: 'Convertisseur Medias',
    appBundleId: 'com.mondobarry.convertisseurmedias',
    icon: './assets/app-icon', // Electron will look for .icns on macOS
    extraResource: [
      './binaries'
    ]
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}, ['darwin']),
    new MakerDMG({
      name: 'Convertisseur-Medias',
      icon: './assets/app-icon.icns',
      format: 'ULFO',
    }),
  ],
  hooks: {
    // Packaging edits Info.plist after Electron's own signature, leaving the bundle with an
    // invalid one: macOS then reports a downloaded copy as "damaged". Re-sign ad hoc.
    postPackage: async (_forgeConfig, options) => {
      const { execFileSync } = await import('child_process');
      for (const outputPath of options.outputPaths) {
        const app = `${outputPath}/Convertisseur Medias.app`;
        execFileSync('codesign', ['--force', '--deep', '--sign', '-', app]);
        execFileSync('codesign', ['--verify', '--deep', '--strict', app]);
      }
    },
  },
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer.ts',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
            },
          },
        ],
      },
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
