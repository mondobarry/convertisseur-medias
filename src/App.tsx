import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

import {
    AUDIO_FORMATS, FILTERS, RESOLUTIONS, TARGET_FORMATS,
    FilterId, Resolution, TargetFormat,
    buildConversionArgs, isConvertedOutput, parseCommandLine,
} from './ffmpeg-args';

// Cover art in audio files is reported as a video stream: ignore it
const videoStreamOf = (info: any) =>
    info?.streams?.find((s: any) => s.codec_type === 'video' && !s.disposition?.attached_pic);
const hasAudioStream = (info: any) => !!info?.streams?.some((s: any) => s.codec_type === 'audio');

const Tabs = { CONVERT: 'CONVERT', EDIT: 'EDIT', FILTERS: 'FILTERS', EXPERT: 'EXPERT' };

const App = () => {
    const [activeTab, setActiveTab] = useState(Tabs.CONVERT);
    const [fileLocalPath, setFileLocalPath] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [fileInfo, setFileInfo] = useState<any>(null);
    const [outputDir, setOutputDir] = useState<string | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [status, setStatus] = useState<string>('Prêt');

    // Edit state
    const [startTime, setStartTime] = useState('00:00:00');
    const [duration, setDuration] = useState('');
    const [resolution, setResolution] = useState<Resolution>('original');

    // Filters state
    const [filterId, setFilterId] = useState<FilterId>('none');

    // Expert Mode state
    const [customCommand, setCustomCommand] = useState('');

    // Universal Export state
    const [targetExt, setTargetExt] = useState<TargetFormat>('mp4');
    const [batchFiles, setBatchFiles] = useState<string[]>([]);

    const videoStream = videoStreamOf(fileInfo);
    const hasVideo = !!videoStream;

    useEffect(() => {
        const unsubscribe = window.electronAPI.onProgress((data) => {
            if (data.log.includes('frame=') || data.log.includes('size=')) {
                setStatus(`En cours : ${data.log.split('fps=')[0].trim()}`);
            }
            setLogs((prev) => [...prev.slice(-30), data.log]);
        });
        return () => unsubscribe();
    }, []);

    const handleFileSelected = async (path: string) => {
        setBatchFiles([]);
        setFileLocalPath(path);
        const name = path.split('/').pop() || 'Fichier inconnu';
        setFileName(name);

        const ext = name.split('.').pop()?.toLowerCase() as TargetFormat;
        if (ext && TARGET_FORMATS.includes(ext)) {
            setTargetExt(ext);
        }

        setStatus('Analyse...');
        const info = await window.electronAPI.getFileInfo(path);
        if (info.error) {
            setStatus(`Erreur d'analyse : ${info.error}`);
            setLogs([`❌ Analyse échouée: ${info.error}`]);
            setFileInfo(null);
        } else {
            setFileInfo(info);
            setStatus('Fichier analysé');
        }
    };

    const handleFolderSelected = async (path: string) => {
        setStatus('Scan du dossier...');
        const files = await window.electronAPI.listFiles(path);
        if ('error' in files) {
            setStatus(`Erreur scan : ${files.error}`);
            return;
        }

        const filteredFiles = (Array.isArray(files) ? files : []).filter(f => !isConvertedOutput(f));
        if (filteredFiles.length === 0) {
            setStatus('Aucun média trouvé');
            return;
        }

        setBatchFiles(filteredFiles);
        setFileLocalPath(null);
        setFileName(`Dossier (${filteredFiles.length} fichiers)`);
        setFileInfo(null);
        setStatus(`${filteredFiles.length} fichiers prêts`);
    };

    const clearFile = () => {
        setFileLocalPath(null);
        setFileName(null);
        setFileInfo(null);
        setBatchFiles([]);
        setStatus('Prêt');
    };

    const runFFmpeg = async (args: string[]): Promise<boolean> => {
        const result = await window.electronAPI.runFFmpeg(args);
        if (result.success) return true;
        const errorMsg = result.error ? `Erreur : ${result.error}` : `Erreur ffmpeg (code ${result.code})`;
        setLogs(prev => [...prev, `❌ ${errorMsg}`]);
        return false;
    };

    const runExpertCommand = async () => {
        const args = parseCommandLine(customCommand);
        if (args.length === 0) return;
        setLogs([]);
        setIsConverting(true);
        setStatus('Commande en cours...');
        const ok = await runFFmpeg(args);
        setIsConverting(false);
        setStatus(ok ? 'Terminé !' : 'Échec de la commande');
    };

    const runConversion = async () => {
        const filesToProcess = batchFiles.length > 0 ? batchFiles : (fileLocalPath ? [fileLocalPath] : []);
        if (filesToProcess.length === 0) return;

        setLogs([]);
        setIsConverting(true);
        let succeeded = 0;

        for (let i = 0; i < filesToProcess.length; i++) {
            const currentPath = filesToProcess[i];
            const currentName = currentPath.split('/').pop()!;
            setStatus(filesToProcess.length > 1
                ? `Traitement ${i + 1}/${filesToProcess.length} : ${currentName}`
                : `Conversion de ${currentName}...`);

            const info = await window.electronAPI.getFileInfo(currentPath);
            if (info.error) {
                setLogs(prev => [...prev, `❌ ${currentName} : analyse impossible (${info.error})`]);
                continue;
            }

            const built = buildConversionArgs({
                input: currentPath,
                outputDir: outputDir || currentPath.substring(0, currentPath.lastIndexOf('/')),
                targetExt,
                hasVideo: !!videoStreamOf(info),
                hasAudio: hasAudioStream(info),
                startTime,
                duration,
                resolution,
                filterId,
            });
            if ('error' in built) {
                setLogs(prev => [...prev, `⚠️ ${currentName} : ${built.error}`]);
                continue;
            }

            setLogs(prev => [...prev, `▶ ffmpeg ${built.args.join(' ')}`]);
            if (await runFFmpeg(built.args)) succeeded++;
        }

        setIsConverting(false);
        setStatus(succeeded === filesToProcess.length
            ? 'Terminé !'
            : `Terminé avec des erreurs : ${succeeded}/${filesToProcess.length} réussi(s)`);
    };

    const settingsSummary = [
        startTime.trim() && !/^0*(:0*)*$/.test(startTime.trim()) ? `début ${startTime.trim()}` : '',
        duration.trim() ? `durée ${duration.trim()} s` : '',
        resolution !== 'original' && !AUDIO_FORMATS.includes(targetExt) ? resolution.replace(':', 'x') : '',
        filterId !== 'none' && !AUDIO_FORMATS.includes(targetExt) ? FILTERS.find(f => f.id === filterId)!.label : '',
    ].filter(Boolean).join(' · ');

    return (
        <div className="app-container">
            <nav className="sidebar">
                <div className="logo">Convertisseur Médias</div>
                <button className={`nav-item ${activeTab === Tabs.CONVERT ? 'active' : ''}`} onClick={() => setActiveTab(Tabs.CONVERT)}>🔄 Convertir</button>
                <button className={`nav-item ${activeTab === Tabs.EDIT ? 'active' : ''}`} onClick={() => setActiveTab(Tabs.EDIT)}>✂️ Éditer</button>
                <button className={`nav-item ${activeTab === Tabs.FILTERS ? 'active' : ''}`} onClick={() => setActiveTab(Tabs.FILTERS)}>🎭 Filtres</button>
                <button className={`nav-item ${activeTab === Tabs.EXPERT ? 'active' : ''}`} onClick={() => setActiveTab(Tabs.EXPERT)}>💻 Expert</button>

                <div className="meta-box">
                    {fileInfo ? (
                        <div className="metadata">
                            <h4>{hasVideo ? 'Fichier Vidéo' : 'Fichier Audio'}</h4>
                            <p><strong>Durée:</strong> {Math.round(fileInfo.format?.duration || 0)}s</p>
                            <p><strong>Codec:</strong> {fileInfo.streams?.[0]?.codec_name}</p>
                            {hasVideo && <p><strong>Dim:</strong> {videoStream.width}x{videoStream.height}</p>}
                        </div>
                    ) : <p className="dim">Aucun fichier</p>}
                </div>
            </nav>

            <main className="main-content">
                <header className="main-header">
                    <div className="file-selector-container">
                        <button className="btn-folder-select" onClick={async () => { const p = await window.electronAPI.selectFolder(); if (p) handleFolderSelected(p); }} title="Convertir tout un dossier">📂 Dossier</button>
                        <div className="file-selector" onClick={async () => { if (!fileName) { const p = await window.electronAPI.openFile(); if (p) handleFileSelected(p); } }}>
                            {fileName ? `📄 ${fileName}` : '➕ Fichier'}
                        </div>
                        {fileName && <button className="btn-remove" onClick={clearFile} title="Retirer">✕</button>}
                    </div>
                </header>

                <div className="scroll-content">
                    {activeTab === Tabs.CONVERT && (
                        <section className="tab-view centered">
                            <div className="empty-state">
                                <h3>Conversion Directe</h3>
                                <p>Le codec adapté est choisi automatiquement selon le format de sortie et le contenu de votre {batchFiles.length > 0 ? 'dossier' : (hasVideo ? 'vidéo' : 'fichier')}.</p>
                                <p className="hint">Choisissez le format ci-dessous. Découpe, résolution et filtres des autres onglets sont appliqués automatiquement.</p>
                            </div>
                        </section>
                    )}

                    {activeTab === Tabs.EDIT && (
                        <section className="tab-view">
                            <h3>Découpe & Résolution</h3>
                            <div className="form-group">
                                <label>Début (ex : 00:00:10 ou 10)</label>
                                <input type="text" value={startTime} onChange={e => setStartTime(e.target.value)} />
                                <label>Durée (facultatif, en secondes)</label>
                                <input type="text" value={duration} onChange={e => setDuration(e.target.value)} placeholder="ex: 30" />
                            </div>
                            <h3>Redimensionner</h3>
                            <div className="grid">
                                {RESOLUTIONS.map(r => (
                                    <div key={r} className={`card ${resolution === r ? 'active' : ''}`} onClick={() => setResolution(r)}>{r === 'original' ? 'Original' : r.replace(':', 'x')}</div>
                                ))}
                            </div>
                        </section>
                    )}

                    {activeTab === Tabs.FILTERS && (
                        <section className="tab-view">
                            <h3>Effets Visuels</h3>
                            <div className="grid">
                                {FILTERS.map(f => (
                                    <div key={f.id} className={`card ${filterId === f.id ? 'active' : ''}`} onClick={() => setFilterId(f.id)}>{f.label}</div>
                                ))}
                            </div>
                        </section>
                    )}

                    {activeTab === Tabs.EXPERT && (
                        <section className="tab-view">
                            <h3>Mode Console</h3>
                            <textarea className="expert-box" value={customCommand} onChange={e => setCustomCommand(e.target.value)} placeholder='-i "/chemin/avec espaces/film.mov" -c:v libx264 "/chemin/sortie.mp4"' />
                            <button className="btn-run expert" disabled={isConverting} onClick={runExpertCommand}>Exécuter</button>
                        </section>
                    )}
                </div>

                <footer className="main-footer">
                    <div className="format-selection-row">
                        <div className="format-label">Format de sortie</div>
                        <div className="format-list">
                            {TARGET_FORMATS.map(f => {
                                const isActive = targetExt === f;
                                return (
                                    <div
                                        key={f}
                                        className={`format-chip ${isActive ? 'active' : ''}`}
                                        onClick={() => setTargetExt(f)}
                                    >
                                        {f.toUpperCase()}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {settingsSummary && <div className="settings-summary">Réglages : {settingsSummary}</div>}
                    <div className="dest-row">
                        <button className="btn-folder" onClick={async () => { const p = await window.electronAPI.selectFolder(); if (p) setOutputDir(p) }}>
                            📂 Sortie : {outputDir ? `...${outputDir.slice(-30)}` : 'Dossier d\'origine'}
                        </button>
                    </div>
                    <div className="action-row">
                        <button className="btn-primary" disabled={(!fileLocalPath && batchFiles.length === 0) || isConverting} onClick={runConversion}>
                            {isConverting ? 'Traitement en cours...' : 'Lancer l\'opération'}
                        </button>
                    </div>
                    {logs.length > 0 && (
                        <details className="log-panel">
                            <summary>Journal ({logs.length})</summary>
                            <pre>{logs.join('\n')}</pre>
                        </details>
                    )}
                    <div className="status-row">
                        <span className={`dot ${isConverting ? 'live' : ''}`}></span>
                        <span className={status === 'Terminé !' ? 'success-text' : ''}>{status}</span>
                    </div>
                </footer>
            </main>
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
