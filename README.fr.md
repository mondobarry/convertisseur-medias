[English](README.md) · **Français**

# Convertisseur Médias

Convertisseur audio/vidéo pour macOS, basé sur FFmpeg — un fichier ou un dossier entier en un clic.

![Interface](docs/screenshot.png)

## Fonctionnalités

- **15 formats de sortie** : MP4, MKV, MOV, AVI, WebM, GIF, TS, FLV, MP3, WAV, FLAC, M4A, OGG, PNG, JPG — le codec adapté est choisi automatiquement (H.264 matériel via VideoToolbox, VP9/Opus, palette GIF, etc.)
- **Conversion par lot** : tous les médias d'un dossier et de ses sous-dossiers (fichiers cachés et sorties précédentes ignorés)
- **Découpe** (début, durée), **redimensionnement** (1080p → 360p, proportions conservées) et **filtres** (noir & blanc, sépia, flou, luminosité), combinables
- **Mode Expert** : arguments FFmpeg libres, guillemets gérés pour les chemins avec espaces
- Analyse du fichier (durée, codec, dimensions) via ffprobe, journal FFmpeg consultable

## Compatibilité

- **Mac Apple Silicon (M1 à M4) sous macOS 15 Sequoia ou plus récent** — tous les Mac Apple Silicon peuvent passer à macOS 15
- **Aucune installation requise** : ni Homebrew, ni FFmpeg. FFmpeg et ses 91 bibliothèques sont embarqués dans l'application
- Si le FFmpeg embarqué ne peut pas s'exécuter, l'application utilise automatiquement celui de Homebrew (`/opt/homebrew/bin`) ou de `/usr/local/bin` s'il existe

L'application n'est pas notariée par Apple. Au premier lancement, macOS la bloque : ouvrir
**Réglages Système → Confidentialité et sécurité** et cliquer sur **Ouvrir quand même**.

## Architecture

```
src/ffmpeg-args.ts        Construction des commandes FFmpeg — logique pure, testée
src/ffmpeg-locator.ts     Choix du binaire : embarqué, sinon Homebrew / /usr/local
src/index.ts              Processus principal Electron : dialogues, ffprobe, lancement de ffmpeg
src/preload.ts            API exposée au rendu via contextBridge (contextIsolation, sans nodeIntegration)
src/App.tsx               Interface React
scripts/bundle-ffmpeg.sh  Rend le FFmpeg de Homebrew autonome pour l'embarquer
```

## Développement

Prérequis : macOS, **Node 22** (voir `.nvmrc`) — avec Node 26, l'empaquetage Electron Forge s'arrête silencieusement et le module natif d'`appdmg` ne compile pas.

1. Préparer FFmpeg (non versionné, dans `binaries/arm64/`) :

```bash
brew install ffmpeg dylibbundler
scripts/bundle-ffmpeg.sh
```

   Le script copie `ffmpeg`, `ffprobe` et toutes leurs bibliothèques Homebrew, réécrit les chemins
   vers `@executable_path/libs`, re-signe le tout et échoue s'il reste une dépendance à Homebrew.
   Il affiche la version minimale de macOS du résultat (celle des bouteilles Homebrew).

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

GPL v3 — voir [LICENSE](LICENSE). FFmpeg, distribué avec l'application, est compilé avec `--enable-gpl --enable-version3` ;
son code source est disponible sur [ffmpeg.org](https://ffmpeg.org). Les bibliothèques embarquées
(x264, libvpx, Opus, LAME, etc.) conservent leurs licences respectives.
