# Convertisseur Médias

Convertisseur audio/vidéo pour macOS, basé sur FFmpeg — un fichier ou un dossier entier en un clic.

![Interface](docs/screenshot.png)

## Fonctionnalités

- **15 formats de sortie** : MP4, MKV, MOV, AVI, WebM, GIF, TS, FLV, MP3, WAV, FLAC, M4A, OGG, PNG, JPG — le codec adapté est choisi automatiquement (H.264 matériel via VideoToolbox, VP9/Opus, palette GIF, etc.)
- **Conversion par lot** : tous les médias d'un dossier et de ses sous-dossiers (fichiers cachés et sorties précédentes ignorés)
- **Découpe** (début, durée), **redimensionnement** (1080p → 360p, proportions conservées) et **filtres** (noir & blanc, sépia, flou, luminosité), combinables
- **Mode Expert** : arguments FFmpeg libres, guillemets gérés pour les chemins avec espaces
- Analyse du fichier (durée, codec, dimensions) via ffprobe, journal FFmpeg consultable

## Architecture

```
src/ffmpeg-args.ts   Construction des commandes FFmpeg — logique pure, testée
src/index.ts         Processus principal Electron : dialogues, ffprobe, lancement de ffmpeg
src/preload.ts       API exposée au rendu via contextBridge (contextIsolation, sans nodeIntegration)
src/App.tsx          Interface React
```

## Développement

Prérequis : macOS et **Node 22** (voir `.nvmrc`) — avec Node 26, l'empaquetage Electron Forge s'arrête silencieusement et le module natif d'`appdmg` ne compile pas.

1. Placer des binaires `ffmpeg` et `ffprobe` **statiques** dans `binaries/arm64/` et `binaries/x64/`
   (non versionnés). Un binaire lié à Homebrew ne fonctionnera pas sur un autre Mac —
   vérifier avec `otool -L binaries/arm64/ffmpeg` qu'il ne dépend que de `/usr/lib` et `/System`.
2. Installer et lancer :

```bash
npm install
npm start
```

## Tests

```bash
npm test                                    # tests unitaires
FFMPEG_PATH=binaries/arm64/ffmpeg npm test  # + conversions réelles vers les 15 formats
```

## Construire l'application

```bash
npm run make   # .app, .zip et .dmg dans out/
```

## Stack

Electron · React · TypeScript · Webpack · Electron Forge · FFmpeg · Vitest

## Auteur

**Mamadou Alimou Barry** — [mondobarry.com](https://mondobarry.com)

## Licence

GPL v3 — voir [LICENSE](LICENSE). Les binaires FFmpeg distribués avec l'application sont compilés avec
`--enable-gpl --enable-version3` ; leur code source est disponible sur [ffmpeg.org](https://ffmpeg.org).
