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
    name: 'Convertisseur Médias',
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
      icon: './assets/app-icon.icns',
      format: 'ULFO',
    }),
  ],
  hooks: {
    postPackage: async (forgeConfig, options) => {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      const appName = 'Convertisseur Médias';
      const appPath = path.join(options.outputPaths[0], `${appName}.app`);
      const resourcesPath = path.join(appPath, 'Contents', 'Resources');
      const infoPlistPath = path.join(appPath, 'Contents', 'Info.plist');

      const iconPath = path.join(resourcesPath, 'electron.icns');
      const targetIconPath = path.join(resourcesPath, `${appName}.icns`);

      if (fs.existsSync(iconPath)) {
        fs.renameSync(iconPath, targetIconPath);
      }

      if (fs.existsSync(infoPlistPath)) {
        let content = fs.readFileSync(infoPlistPath, 'utf8');
        content = content.replace(/<key>CFBundleIconFile<\/key>\s*<string>electron\.icns<\/string>/g, `<key>CFBundleIconFile</key><string>${appName}.icns</string>`);
        fs.writeFileSync(infoPlistPath, content);
      }

      execSync(`touch "${appPath}"`);
    }
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
