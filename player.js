
        // DOM
        const btnSelectFolder = document.getElementById('btnSelectFolder');
        const btnRestoreFolder = document.getElementById('btnRestoreFolder');
        const btnClearCache = document.getElementById('btnClearCache');
        const btnRefresh = document.getElementById('btnRefresh');
        const dirHint = document.getElementById('dirHint');
        const folderInput = document.getElementById('folderInput');
        const trackListEl = document.getElementById('trackList');
        const trackMetaEl = document.getElementById('trackMeta');
        const pathBar = document.getElementById('pathBar');
        const audio = document.getElementById('audioPlayer');
        const lyricsContainer = document.getElementById('lyricsContainer');
        const repeatTimesSelect = document.getElementById('repeatTimes');
        const pauseRatioSelect = document.getElementById('pauseRatio');
        const btnToggleLyrics = document.getElementById('btnToggleLyrics');
        const btnPrevTrack = document.getElementById('btnPrevTrack');
        const btnNextTrack = document.getElementById('btnNextTrack');
        const btnPrevLine = document.getElementById('btnPrevLine');
        const btnNextLine = document.getElementById('btnNextLine');
        const btnPlayMode = document.getElementById('btnPlayMode');
        const btnStudyMode = document.getElementById('btnStudyMode');
        const studyModeChildren = document.getElementById('studyModeChildren');
        const btnTranscribe = document.getElementById('btnTranscribe');
        const btnPlayPause = document.getElementById('btnPlayPause');
        const btnOpenSettings = document.getElementById('btnOpenSettings');
        const btnCloseSettings = document.getElementById('btnCloseSettings');
        const settingsSheet = document.getElementById('settingsSheet');
        const sheetBackdrop = document.getElementById('sheetBackdrop');
        const rowTranscribe = document.getElementById('rowTranscribe');
        const timeCur = document.getElementById('timeCur');
        const timeDur = document.getElementById('timeDur');
        const seekBar = document.getElementById('seekBar');
        const statusTag = document.getElementById('statusTag');
        const nowPlayingTitle = document.getElementById('nowPlayingTitle');
        const sidebar = document.getElementById('sidebar');
        const sidebarBackdrop = document.getElementById('sidebarBackdrop');
        const btnOpenList = document.getElementById('btnOpenList');
        const btnCloseList = document.getElementById('btnCloseList');

        // ---------- State ----------
        let mediaTree = null;          // { name, children: Map, tracks: [] }
        let currentPath = [];          // folder path from root, e.g. ['L24','Unit2']
        let currentFolderTracks = [];  // tracks shown in list
        let currentTrackIdx = -1;
        let currentTrackKey = null;
        let currentLrcData = [];
        let activeLineIndex = -1;
        let currentRepeatCount = 0;
        let isPausingForEcho = false;
        let pauseTimer = null;
        let intervalTimer = null;
        let echoGen = 0;
        let echoDeadline = 0;       // wall-clock ms when shadowing pause should end
        let echoCallback = null;
        let userWantsPlay = false;
        let objectUrl = null;
        let usingCachedFiles = false;
        let currentDirHandle = null;
        let rootDirName = '';
        let refreshing = false;
        // Multi-directory roots + LAN server mode
        let mediaRoots = [];           // [{id,name,tree,dirHandle,cached,source}]
        let serverMode = false;
        let serverRootName = '';
        // list = play through and stop | one = repeat current | loop = wrap list
        let playMode = 'one';
        const PLAY_MODE_LABELS = {
            list: '列表顺序',
            one: '单曲循环',
            loop: '列表循环'
        };
        // normal: 1x no pause | shadow: 2x + 2x pause | deep: 3x + 2.5x + hide lyrics
        let studyMode = 'normal';
        const STUDY_MODE_LABELS = {
            normal: '正常播放',
            shadow: '跟读模式',
            deep: '深度跟读'
        };
        const STUDY_MODE_ORDER = ['normal', 'shadow', 'deep'];
        const STUDY_DEFAULTS = {
            normal: { repeat: '1', pause: '0', hideLyrics: false },
            shadow: { repeat: '2', pause: '2', hideLyrics: false },
            deep: { repeat: '3', pause: '2.5', hideLyrics: true }
        };

        // Completed tracks (localStorage)
        const KEY_COMPLETED = 'lp_completed';
        let completedSet = loadCompletedSet();

        function loadCompletedSet() {
            try {
                return new Set(JSON.parse(localStorage.getItem(KEY_COMPLETED) || '[]'));
            } catch {
                return new Set();
            }
        }
        function persistCompleted() {
            try {
                localStorage.setItem(KEY_COMPLETED, JSON.stringify([...completedSet]));
            } catch { /* quota */ }
        }
        function markTrackCompleted(key, done = true) {
            if (!key) return;
            if (done) completedSet.add(key);
            else completedSet.delete(key);
            persistCompleted();
        }

        // Edge-trigger for sentence end
        let sentenceEndArmed = true;
        const REARM_BEFORE_END = 0.25;

        let suppressLineSwitchUntil = -1;

        // ============================================================
        // iOS Safari Audio Session Unlock & Background Keep-Alive
        // - Unlock Web Audio context with dummy buffer on first user gesture
        //   to switch AVAudioSessionCategory to Playback (bypasses silent switch).
        // - Use a background silent looping audio to prevent iOS from freezing
        //   JS timers during shadowing pause while screen is locked.
        // ============================================================
        const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
        let iosUnlocked = false;
        let unlockAudioCtx = null;
        let bgSilentAudio = null;

        function getBgSilentAudio() {
            if (!bgSilentAudio) {
                bgSilentAudio = new Audio(SILENT_AUDIO_URI);
                bgSilentAudio.loop = true;
                bgSilentAudio.preload = 'auto';
                bgSilentAudio.addEventListener('timeupdate', () => {
                    if (isPausingForEcho) completeEchoPauseIfDue();
                });
            }
            return bgSilentAudio;
        }

        function unlockIOSAudio() {
            if (iosUnlocked) return;
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    if (!unlockAudioCtx) {
                        unlockAudioCtx = new AudioCtx();
                    }
                    if (unlockAudioCtx.state === 'suspended') {
                        unlockAudioCtx.resume();
                    }
                    const buf = unlockAudioCtx.createBuffer(1, 1, 22050);
                    const src = unlockAudioCtx.createBufferSource();
                    src.buffer = buf;
                    src.connect(unlockAudioCtx.destination);
                    src.start(0);
                }
            } catch { /* ignore */ }

            try {
                const bg = getBgSilentAudio();
                const p = bg.play();
                if (p && p.then) {
                    p.then(() => {
                        bg.pause();
                        bg.currentTime = 0;
                    }).catch(() => {});
                }
            } catch { /* ignore */ }
            iosUnlocked = true;
        }

        ['touchstart', 'touchend', 'click', 'keydown'].forEach(evt => {
            window.addEventListener(evt, unlockIOSAudio, { capture: true, passive: true });
        });

        // ============================================================
        // Audio engine
        // - NO MediaElementSource (causes iOS/desktop lag & residual tails)
        // - Micro fade 8ms via audio.volume
        // ============================================================

        const FADE_MS = 8;          // micro fade — just enough to kill clicks
        const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
        const SEEK_SETTLE_MS = isSafari ? 140 : 40;

        let fadeRaf = 0;
        let fadeGen = 0;

        function cancelFade() {
            if (fadeRaf) {
                cancelAnimationFrame(fadeRaf);
                fadeRaf = 0;
            }
            fadeGen++;
        }

        function setVolume(v) {
            try { audio.volume = Math.max(0, Math.min(1, v)); } catch { /* ignore */ }
        }

        function stopAudioHard() {
            cancelFade();
            try { audio.pause(); } catch { /* ignore */ }
            restoreVolume();
        }

        function restoreVolume() {
            cancelFade();
            setVolume(1);
        }

        /** 8ms fade-out then pause. Returns a Promise. */
        function smoothPause() {
            return new Promise((resolve) => {
                cancelFade();
                const gen = fadeGen;
                const from = Math.max(audio.volume, 0.0001);
                const start = performance.now();
                const step = () => {
                    if (gen !== fadeGen) { resolve(); return; }
                    const t = (performance.now() - start) / FADE_MS;
                    if (t >= 1 || audio.paused) {
                        try { audio.pause(); } catch { /* ignore */ }
                        resolve();
                        return;
                    }
                    setVolume(from * (1 - t));
                    fadeRaf = requestAnimationFrame(step);
                };
                // if already silent/paused or background tab, skip the ramp
                if (audio.paused || audio.volume <= 0.01 || document.hidden) {
                    try { audio.pause(); } catch { /* ignore */ }
                    resolve();
                    return;
                }
                fadeRaf = requestAnimationFrame(step);
            });
        }

        /** Seek (optional) → play → 8ms fade-in. Returns a Promise. */
        function applySeek(target) {
            const t = Math.max(0, target);
            try { audio.currentTime = t; } catch { /* ignore */ }
            return t;
        }

        function smoothPlay(targetTime) {
            unlockIOSAudio();
            return new Promise((resolve) => {
                cancelFade();
                const seeking = targetTime !== undefined && Number.isFinite(targetTime);
                let seekTarget = null;
                if (seeking) {
                    setVolume(0);
                    seekTarget = applySeek(targetTime);
                } else if (audio.volume < 1) {
                    setVolume(1);
                }

                const gen = fadeGen;
                const doFadeIn = () => {
                    if (gen !== fadeGen) { resolve(); return; }
                    if (document.hidden) {
                        setVolume(1);
                        resolve();
                        return;
                    }
                    const start = performance.now();
                    const step = () => {
                        if (gen !== fadeGen) { resolve(); return; }
                        const t = (performance.now() - start) / FADE_MS;
                        if (t >= 1) {
                            setVolume(1);
                            resolve();
                            return;
                        }
                        setVolume(t);
                        fadeRaf = requestAnimationFrame(step);
                    };
                    setVolume(0);
                    fadeRaf = requestAnimationFrame(step);
                    setTimeout(() => {
                        if (gen === fadeGen && audio.volume < 1) {
                            setVolume(1);
                            resolve();
                        }
                    }, 30);
                };

                let played = false;
                const tryPlay = () => {
                    if (played) return;
                    played = true;
                    // Safari often ignores currentTime until play; re-apply if drifted
                    if (seekTarget != null) {
                        const drift = Math.abs(audio.currentTime - seekTarget);
                        if (drift > 0.2) applySeek(seekTarget);
                    }
                    const p = audio.play();
                    if (p && p.then) {
                        p.then(() => {
                            if (seekTarget != null) {
                                const drift = Math.abs(audio.currentTime - seekTarget);
                                if (drift > 0.2) applySeek(seekTarget);
                            }
                            if (seeking) {
                                doFadeIn();
                            } else {
                                setVolume(1);
                                resolve();
                            }
                        }).catch(() => { setVolume(1); resolve(); });
                    } else {
                        if (seeking) {
                            doFadeIn();
                        } else {
                            setVolume(1);
                            resolve();
                        }
                    }
                };

                if (seeking) {
                    const onSeeked = () => {
                        audio.removeEventListener('seeked', onSeeked);
                        if (seekTarget != null && Math.abs(audio.currentTime - seekTarget) > 0.25) {
                            applySeek(seekTarget);
                        }
                        tryPlay();
                    };
                    audio.addEventListener('seeked', onSeeked, { once: true });
                    setTimeout(() => {
                        audio.removeEventListener('seeked', onSeeked);
                        tryPlay();
                    }, SEEK_SETTLE_MS);
                } else {
                    tryPlay();
                }
            });
        }

        const AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'];
        const SUB_EXTS = { '.srt': 'srt' };
        const CACHE_SIZE_LIMIT = 400 * 1024 * 1024;
        const supportsFSA = typeof window.showDirectoryPicker === 'function';

        // ---------- IndexedDB ----------
        const DB_NAME = 'lang-player';
        const STORE = 'fs';
        const KEY_DIR = 'dirHandle';
        const KEY_NAME = 'dirName';
        const KEY_CACHED_FILES = 'cachedFiles';
        const KEY_CACHED_NAME = 'cachedDirName';
        const KEY_DIR_LIST = 'dirHandleList';
        const KEY_CACHED_LIST = 'cachedRootList';

        function openDB() {
            return new Promise((resolve, reject) => {
                const req = indexedDB.open(DB_NAME, 1);
                req.onupgradeneeded = () => {
                    if (!req.result.objectStoreNames.contains(STORE)) {
                        req.result.createObjectStore(STORE);
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }

        async function idbGet(key) {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE, 'readonly');
                const req = tx.objectStore(STORE).get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }

        async function idbSet(key, value) {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE, 'readwrite');
                tx.objectStore(STORE).put(value, key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        }

        async function idbDel(key) {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE, 'readwrite');
                tx.objectStore(STORE).delete(key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        }

        async function ensureDirPermission(dirHandle, withPrompt) {
            const opts = { mode: 'read' };
            try {
                if ((await dirHandle.queryPermission(opts)) === 'granted') return true;
                if (!withPrompt) return false;
                return (await dirHandle.requestPermission(opts)) === 'granted';
            } catch {
                return false;
            }
        }

        // Collect files with folder path (FSA)
        async function collectFSAEntries(dirHandle, folderPath = '', out = []) {
            for await (const [name, handle] of dirHandle.entries()) {
                if (handle.kind === 'file') {
                    try {
                        const file = await handle.getFile();
                        out.push({ file, folderPath, name });
                    } catch { /* skip */ }
                } else if (handle.kind === 'directory') {
                    const nextPath = folderPath ? folderPath + '/' + name : name;
                    await collectFSAEntries(handle, nextPath, out);
                }
            }
            return out;
        }

        // Convert webkit FileList to entries
        function entriesFromWebkitFiles(files) {
            if (!files.length) return { rootName: '所选文件夹', entries: [] };
            const first = files[0];
            const rel = first.webkitRelativePath || first.name;
            const parts = rel.split('/');
            const rootName = parts.length > 1 ? parts[0] : '所选文件夹';

            const entries = files.map(f => {
                const p = (f.webkitRelativePath || f.name).split('/');
                const name = p[p.length - 1];
                let folderPath = '';
                if (p.length > 1) {
                    // drop root folder segment if present
                    const start = (p[0] === rootName) ? 1 : 0;
                    folderPath = p.slice(start, -1).join('/');
                }
                return { file: f, folderPath, name };
            });
            return { rootName, entries };
        }

        function compareNames(a, b) {
            return String(a).localeCompare(String(b), 'zh-Hans-CN', {
                numeric: true,
                sensitivity: 'base'
            });
        }

        function isRelevantName(name) {
            const dot = name.lastIndexOf('.');
            if (dot === -1) return false;
            const ext = name.slice(dot).toLowerCase();
            return AUDIO_EXTS.includes(ext) || !!SUB_EXTS[ext];
        }

        function makeTrackKey(root, folderPath, title) {
            return root + '/' + (folderPath ? folderPath + '/' : '') + title;
        }

        // Build folder tree from file entries
        function buildTreeFromEntries(rootName, entries) {
            const root = { name: rootName, children: new Map(), tracks: [] };
            const groups = new Map();

            for (const { file, folderPath, name } of entries) {
                if (!isRelevantName(name)) continue;
                const dot = name.lastIndexOf('.');
                const base = name.slice(0, dot);
                const ext = name.slice(dot).toLowerCase();
                const gkey = (folderPath || '') + '\0' + base;

                if (!groups.has(gkey)) {
                    groups.set(gkey, { folderPath: folderPath || '', base, audio: null, sub: null, subType: null });
                }
                const g = groups.get(gkey);
                if (AUDIO_EXTS.includes(ext)) {
                    g.audio = file;
                } else if (SUB_EXTS[ext]) {
                    g.sub = file;
                    g.subType = 'srt';
                }
            }

            for (const g of groups.values()) {
                if (!g.audio) continue;
                const parts = g.folderPath ? g.folderPath.split('/') : [];
                let node = root;
                for (const p of parts) {
                    if (!node.children.has(p)) {
                        node.children.set(p, { name: p, children: new Map(), tracks: [] });
                    }
                    node = node.children.get(p);
                }
                node.tracks.push({
                    title: g.base,
                    audioFile: g.audio,
                    subFile: g.sub,
                    subType: g.subType,
                    folderPath: g.folderPath,
                    key: makeTrackKey(rootName, g.folderPath, g.base)
                });
            }

            sortTree(root);
            return root;
        }

        function sortTree(node) {
            node.tracks.sort((a, b) => compareNames(a.title, b.title));
            for (const child of node.children.values()) sortTree(child);
        }

        function getNodeAtPath(tree, path) {
            let node = tree;
            for (const p of path) {
                if (!node || !node.children.has(p)) return null;
                node = node.children.get(p);
            }
            return node;
        }

        function folderTrackCount(node) {
            let n = node.tracks.length;
            for (const c of node.children.values()) n += folderTrackCount(c);
            return n;
        }

        // ---------- Mobile drawer ----------
        function openSidebar() {
            sidebar.classList.add('open');
            sidebarBackdrop.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
        function closeSidebar() {
            sidebar.classList.remove('open');
            sidebarBackdrop.classList.remove('show');
            document.body.style.overflow = '';
        }
        btnOpenList.addEventListener('click', openSidebar);
        btnCloseList.addEventListener('click', closeSidebar);
        sidebarBackdrop.addEventListener('click', closeSidebar);

        function setStatus(text) {
            if (statusTag) statusTag.textContent = text;
        }

        function cancelEchoPause(reason) {
            echoGen++;
            if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
            if (intervalTimer) { clearInterval(intervalTimer); intervalTimer = null; }
            try {
                if (bgSilentAudio) bgSilentAudio.pause();
            } catch { /* ignore */ }
            isPausingForEcho = false;
            echoDeadline = 0;
            echoCallback = null;
            if (reason) setStatus(reason);
        }

        /** Finish a shadowing pause if its wall-clock deadline has passed. */
        function completeEchoPauseIfDue() {
            if (!isPausingForEcho || !echoCallback) return false;
            if (Date.now() < echoDeadline) return false;
            try {
                if (bgSilentAudio) bgSilentAudio.pause();
            } catch { /* ignore */ }
            const cb = echoCallback;
            const gen = echoGen;
            if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
            isPausingForEcho = false;
            echoDeadline = 0;
            echoCallback = null;
            setStatus('播放中');
            userWantsPlay = true;
            Promise.resolve().then(() => cb()).catch(() => {});
            return gen === echoGen;
        }

        function formatClock(sec) {
            if (!Number.isFinite(sec) || sec < 0) return '0:00';
            const m = Math.floor(sec / 60);
            const s = Math.floor(sec % 60);
            return m + ':' + String(s).padStart(2, '0');
        }

        function updatePlayPauseIcon() {
            if (!btnPlayPause) return;
            const playing = !audio.paused && !audio.ended;
            btnPlayPause.textContent = playing ? '\u23F8' : '\u25B6';
            btnPlayPause.setAttribute('aria-label', playing ? '暂停' : '播放');
        }

        function openSettingsSheet() {
            if (!settingsSheet) return;
            settingsSheet.hidden = false;
            if (sheetBackdrop) sheetBackdrop.classList.add('show');
        }
        function closeSettingsSheet() {
            if (!settingsSheet) return;
            settingsSheet.hidden = true;
            if (sheetBackdrop) sheetBackdrop.classList.remove('show');
        }
        if (btnOpenSettings) btnOpenSettings.addEventListener('click', openSettingsSheet);
        if (btnCloseSettings) btnCloseSettings.addEventListener('click', closeSettingsSheet);
        if (sheetBackdrop) sheetBackdrop.addEventListener('click', closeSettingsSheet);

        function trackRelPath(track) {
            if (!track) return null;
            if (track.relPath) return track.relPath;
            // Derive from /media/xxx.mp3 if server omitted relPath
            if (track.audioUrl && track.audioUrl.indexOf('/media/') === 0) {
                try {
                    return decodeURIComponent(track.audioUrl.slice('/media/'.length));
                } catch {
                    return track.audioUrl.slice('/media/'.length);
                }
            }
            return null;
        }

        function updateTranscribeBtn(track) {
            // Always available in server mode — re-transcribe even if SRT/LRC exists
            const can = !!(serverMode && track && track.audioUrl && trackRelPath(track));
            const hasSub = !!(track && (track.subUrl || track.subFile || track.subType));
            if (rowTranscribe) rowTranscribe.hidden = !can;
            if (btnTranscribe) {
                btnTranscribe.hidden = !can;
                btnTranscribe.disabled = false;
                btnTranscribe.textContent = hasSub ? '重新转录字幕' : '转录字幕';
            }
        }

        async function transcribeCurrentTrack() {
            if (!serverMode || !currentFolderTracks[currentTrackIdx]) return;
            const track = currentFolderTracks[currentTrackIdx];
            const rel = trackRelPath(track);
            if (!rel) {
                setStatus('仅服务器目录支持转录');
                return;
            }
            const hasSub = !!(track.subUrl || track.subFile || track.subType);
            if (hasSub) {
                const ok = window.confirm('该曲已有字幕，重新转录会覆盖旧文件。继续？');
                if (!ok) return;
            }
            if (btnTranscribe) {
                btnTranscribe.disabled = true;
                btnTranscribe.textContent = '转录中…';
            }
            setStatus(hasSub
                ? '正在重新转录…（覆盖旧字幕，可能需要几分钟）'
                : '正在调用服务器 Whisper 转录…（可能需要几分钟）');
            try {
                const res = await fetch('/api/transcribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: rel, format: 'srt', force: true })
                });
                const data = await res.json();
                if (!data.ok) {
                    throw new Error(data.error || data.detail || '转录失败');
                }
                track.subUrl = data.subUrl;
                track.subType = data.subType || 'srt';
                try {
                    await refreshDirectoryKeepPlayback({ quiet: true });
                } catch { /* ignore */ }
                if (mediaTree) {
                    const node = getNodeAtPath(mediaTree, currentPath);
                    if (node) {
                        const idx = node.tracks.findIndex(t => t.key === currentTrackKey || t.title === track.title);
                        if (idx >= 0) {
                            currentFolderTracks = node.tracks;
                            currentTrackIdx = idx;
                        }
                    }
                }
                const fresh = currentFolderTracks[currentTrackIdx];
                if (fresh && (fresh.subUrl || fresh.subFile)) {
                    let subText = null;
                    if (fresh.subUrl) {
                        const r = await fetch(fresh.subUrl, { cache: 'no-cache' });
                        if (r.ok) subText = await r.text();
                    } else if (fresh.subFile) {
                        subText = await fresh.subFile.text();
                    }
                    if (subText) {
                        currentLrcData = parseSRT(subText);
                        renderLyrics();
                        setStatus(data.retranscribed
                            ? '已重新转录 · 字幕已更新'
                            : '转录完成 · 已加载字幕');
                    } else {
                        setStatus('转录完成，但读取字幕失败');
                    }
                } else {
                    setStatus(data.message || '转录完成');
                }
                renderBrowser();
                updateTranscribeBtn(fresh || track);
            } catch (err) {
                console.error('Transcribe failed', err);
                setStatus('转录失败：' + (err.message || err));
            } finally {
                if (btnTranscribe) {
                    btnTranscribe.disabled = false;
                    const t = currentFolderTracks[currentTrackIdx];
                    updateTranscribeBtn(t);
                }
            }
        }

        if (btnTranscribe) {
            btnTranscribe.addEventListener('click', () => { transcribeCurrentTrack(); });
        }

        // ---------- Playback state helpers ----------
        function clearPlaybackState() {
            currentTrackIdx = -1;
            currentTrackKey = null;
            activeLineIndex = -1;
            currentLrcData = [];
            currentRepeatCount = 0;
            cancelEchoPause();
            isPausingForEcho = false;
            sentenceEndArmed = true;
            suppressLineSwitchUntil = -1;
            pauseTimer = null;
            intervalTimer = null;
            stopAudioHard();
            if (objectUrl) {
                try { URL.revokeObjectURL(objectUrl); } catch { /* ignore */ }
                objectUrl = null;
            }
            audio.removeAttribute('src');
            try { audio.load(); } catch { /* ignore */ }
            restoreVolume();
        }

        function setDirHint(name, extra) {
            dirHint.hidden = false;
            dirHint.innerHTML = '';
            const line = document.createElement('div');
            line.append('目录：');
            const strong = document.createElement('strong');
            strong.textContent = name;
            line.appendChild(strong);
            dirHint.appendChild(line);
            if (extra) {
                const more = document.createElement('div');
                more.textContent = extra;
                dirHint.appendChild(more);
            }
        }

        // Virtual root lists every loaded directory; click to enter.
        function rebuildVirtualRoot() {
            const children = new Map();
            for (const r of mediaRoots) {
                let name = r.name || '未命名';
                let n = 2;
                while (children.has(name)) name = `${r.name} (${n++})`;
                r.displayName = name;
                children.set(name, r.tree);
            }
            mediaTree = {
                name: '',
                isVirtualRoot: true,
                children,
                tracks: []
            };
            if (mediaRoots.length === 1) rootDirName = mediaRoots[0].displayName;
            else rootDirName = '';
            usingCachedFiles = mediaRoots.length > 0 && mediaRoots.every(r => r.cached);
            currentDirHandle = mediaRoots.find(r => r.dirHandle)?.dirHandle || null;
        }

        function countRootsTracks() {
            let n = 0;
            for (const r of mediaRoots) n += folderTrackCount(r.tree);
            return n;
        }

        function updateDirHint() {
            if (serverMode) {
                setDirHint(serverRootName || '服务器目录', '局域网共用 · ⟳ 刷新');
                return;
            }
            if (!mediaRoots.length) {
                dirHint.hidden = true;
                return;
            }
            const names = mediaRoots.map(r => r.displayName || r.name).join('、');
            let extra;
            if (mediaRoots.length === 1 && mediaRoots[0].cached) {
                extra = '来源：浏览器缓存 · 新增请点 ⟳ 重新选择';
            } else if (mediaRoots.length === 1 && mediaRoots[0].source === 'fsa') {
                extra = '可继续「添加目录」· ⟳ 刷新新增文件';
            } else if (mediaRoots.length > 1) {
                extra = `已加载 ${mediaRoots.length} 个目录 · 可继续添加`;
            } else {
                extra = '可点 ⟳ 刷新';
            }
            setDirHint(names, extra);
        }

        function adoptTree(tree, { autoplay = false, cached = false, resetPath = true, enterFolder = false, add = false, dirHandle = null, source = 'fsa' } = {}) {
            const playingKey = currentTrackKey;
            const wasPlaying = !audio.paused && !audio.ended && playingKey;

            if (add) {
                mediaRoots.push({
                    id: String(Date.now()) + '_' + Math.random().toString(36).slice(2, 7),
                    name: tree.name,
                    tree,
                    dirHandle: dirHandle || null,
                    cached: !!cached,
                    source: source || 'fsa'
                });
            } else {
                mediaRoots = [{
                    id: String(Date.now()) + '_' + Math.random().toString(36).slice(2, 7),
                    name: tree.name,
                    tree,
                    dirHandle: dirHandle || null,
                    cached: !!cached,
                    source: source || 'fsa'
                }];
            }

            rebuildVirtualRoot();
            updateDirHint();
            btnRefresh.hidden = !mediaTree;
            btnClearCache.hidden = !(mediaRoots.some(r => r.cached) || (!supportsFSA && mediaRoots.length));
            // Button becomes "add another" once something is loaded (non-server)
            if (!serverMode) {
                btnSelectFolder.textContent = mediaRoots.length ? '添加目录' : '选择本地音频目录';
            }

            if (resetPath) {
                currentPath = enterFolder && rootDirName ? [rootDirName] : [];
            } else if (!getNodeAtPath(mediaTree, currentPath)) {
                currentPath = mediaRoots.length === 1 ? [mediaRoots[0].displayName] : [];
            }

            renderBrowser();

            if (autoplay && !wasPlaying) {
                autoPlayFirstAvailable();
            }

            if (!wasPlaying && !add) {
                updateNowPlaying(null);
                if (!currentLrcData.length) {
                    lyricsContainer.innerHTML = `
                        <div class="lyrics-empty">
                            <strong>已加载目录</strong>
                            点击文件夹进入后选择曲目播放
                        </div>`;
                }
            }
        }

        // Convert server JSON tree → Map tree with track keys
        function treeFromServerNode(node, rootName) {
            function conv(n, folderPath) {
                const out = { name: n.name, children: new Map(), tracks: [] };
                const tracks = n.tracks || [];
                for (const t of tracks) {
                    out.tracks.push({
                        title: t.title,
                        audioUrl: t.audioUrl,
                        subUrl: t.subUrl || null,
                        subType: t.subType || null,
                        folderPath: t.folderPath || folderPath || '',
                        relPath: t.relPath || null,
                        key: makeTrackKey(rootName, t.folderPath || folderPath || '', t.title)
                    });
                }
                out.tracks.sort((a, b) => compareNames(a.title, b.title));
                const ch = n.children || {};
                for (const name of Object.keys(ch)) {
                    const childPath = folderPath ? folderPath + '/' + name : name;
                    out.children.set(name, conv(ch[name], childPath));
                }
                return out;
            }
            return conv(node, '');
        }

        async function loadServerTree() {
            let res = null;
            try {
                res = await fetch('tree.json', { cache: 'no-store' });
            } catch { /* ignore */ }
            if (!res || !res.ok) {
                res = await fetch('/api/tree', { cache: 'no-store' });
            }
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'bad tree');
            const rootName = data.rootName || '媒体库';
            const tree = treeFromServerNode(data.tree, rootName);
            return { tree, rootName };
        }

        function refreshDirectoryKeepPlayback({ quiet = false } = {}) {
            if (refreshing) return Promise.resolve(false);
            refreshing = true;
            if (!quiet) setStatus('刷新中…');

            return (async () => {
                try {
                    // LAN server mode
                    if (serverMode) {
                        const { tree, rootName } = await loadServerTree();
                        serverRootName = rootName;
                        // replace server root in place (keep local extra roots)
                        const idx = mediaRoots.findIndex(r => r.source === 'server');
                        const entry = {
                            id: 'server',
                            name: rootName,
                            tree,
                            dirHandle: null,
                            cached: false,
                            source: 'server'
                        };
                        if (idx >= 0) mediaRoots[idx] = entry;
                        else mediaRoots.unshift(entry);
                        const prevPath = currentPath.slice();
                        rebuildVirtualRoot();
                        updateDirHint();
                        if (!getNodeAtPath(mediaTree, prevPath)) {
                            currentPath = mediaRoots.length === 1 ? [entry.displayName || rootName] : [];
                        }
                        renderBrowser();
                        rebindCurrentTrack();
                        if (!quiet) setStatus(`已刷新 · ${folderTrackCount(tree)} 首`);
                        return true;
                    }

                    // Refresh every FSA root we still have a handle for
                    const fsaRoots = mediaRoots.filter(r => r.dirHandle);
                    if (!fsaRoots.length) {
                        if (!quiet) setStatus(usingCachedFiles || !supportsFSA ? '缓存/无句柄，请点添加目录' : '无目录句柄');
                        return false;
                    }
                    let total = 0;
                    for (const r of fsaRoots) {
                        const ok = await ensureDirPermission(r.dirHandle, false);
                        if (!ok) continue;
                        const entries = await collectFSAEntries(r.dirHandle);
                        r.tree = buildTreeFromEntries(r.dirHandle.name, entries);
                        total += folderTrackCount(r.tree);
                    }
                    const prevPath = currentPath.slice();
                    rebuildVirtualRoot();
                    updateDirHint();
                    if (!getNodeAtPath(mediaTree, prevPath)) {
                        currentPath = mediaRoots.length === 1 ? [mediaRoots[0].displayName] : [];
                    }
                    renderBrowser();
                    rebindCurrentTrack();
                    if (!quiet) setStatus(`已刷新 · ${total} 首`);
                    return true;
                } catch (err) {
                    console.warn('Refresh failed', err);
                    if (!quiet) setStatus('刷新失败');
                    return false;
                } finally {
                    refreshing = false;
                }
            })();
        }

        function countAllTracks(node) {
            return folderTrackCount(node);
        }

        function findTrackByKey(tree, key) {
            if (!tree || !key) return null;
            function walk(n) {
                for (const t of n.tracks) {
                    if (t.key === key) return t;
                }
                for (const c of n.children.values()) {
                    const found = walk(c);
                    if (found) return found;
                }
                return null;
            }
            return walk(tree);
        }

        function rebindCurrentTrack() {
            if (!currentTrackKey || !mediaTree) return;
            const fresh = findTrackByKey(mediaTree, currentTrackKey);
            if (!fresh) return;
            // Keep playing the old objectURL; update list data for badges/labels
            const node = getNodeAtPath(mediaTree, currentPath);
            if (node) {
                const idx = node.tracks.findIndex(t => t.key === currentTrackKey);
                if (idx >= 0) currentTrackIdx = idx;
            }
            renderBrowser();
        }

        // Tab visibility: never pause audio here. If the browser suspended
        // playback in background and the user still wants play, resume on return.
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            // 1) Shadowing pause: if wall-clock wait already elapsed while tab was frozen, continue now
            if (isPausingForEcho) {
                if (Date.now() >= echoDeadline) {
                    completeEchoPauseIfDue();
                } else {
                    // Still waiting — re-arm poll with true remaining time
                    const gen = echoGen;
                    const remain = echoDeadline - Date.now();
                    if (pauseTimer) clearTimeout(pauseTimer);
                    pauseTimer = setTimeout(() => {
                        if (gen !== echoGen) return;
                        completeEchoPauseIfDue();
                    }, Math.max(50, remain));
                    setStatus(`跟读停顿中…`);
                }
            } else if (userWantsPlay && audio.src && audio.paused) {
                // 2) System paused audio in background — resume shadowing playback
                smoothPlay().catch(() => {});
            }
            playbackTick();
            if (serverMode || (currentDirHandle && !usingCachedFiles)) {
                refreshDirectoryKeepPlayback({ quiet: true });
            }
        });

        btnRefresh.addEventListener('click', () => {
            unlockIOSAudio();
            if (serverMode) {
                refreshDirectoryKeepPlayback({ quiet: false });
                return;
            }
            // Safari / cache: re-pick. FSA: real refresh.
            if (supportsFSA && mediaRoots.some(r => r.dirHandle)) {
                refreshDirectoryKeepPlayback({ quiet: false });
                return;
            }
            setStatus('请添加/重新选择目录以加载新增文件');
            folderInput.click();
        });

        // ---------- Cache (Safari) ----------
        async function cacheEntriesToIDB(entries, dirName) {
            return cacheRootToIDB(dirName, entries);
        }

        async function clearBrowserCache() {
            try {
                await idbDel(KEY_CACHED_FILES);
                await idbDel(KEY_CACHED_NAME);
                await idbDel(KEY_CACHED_LIST);
                if (!supportsFSA) {
                    await idbDel(KEY_DIR);
                    await idbDel(KEY_NAME);
                }
                btnClearCache.hidden = true;
                usingCachedFiles = false;
                if (!supportsFSA) setDirHint('已清除', '重新选择文件夹可再次缓存');
                setStatus('已清除浏览器缓存');
            } catch {
                setStatus('清除失败');
            }
        }

        btnClearCache.addEventListener('click', async () => {
            if (!confirm('清除浏览器中缓存的音频与字幕？')) return;
            await clearBrowserCache();
        });

        // ---------- Folder selection ----------
        async function persistDirHandleList() {
            try {
                const handles = mediaRoots.filter(r => r.dirHandle).map(r => r.dirHandle);
                await idbSet(KEY_DIR_LIST, handles);
                if (handles.length) await idbSet(KEY_DIR, handles[handles.length - 1]);
            } catch { /* ignore */ }
        }

        /** Append/replace one cached root (Safari / webkit). Keeps all roots. */
        async function cacheRootToIDB(rootName, entries) {
            const relevant = entries.filter(e => isRelevantName(e.name));
            const totalSize = relevant.reduce((s, e) => s + (e.file.size || 0), 0);
            if (totalSize > CACHE_SIZE_LIMIT) {
                return { ok: false, reason: `文件共 ${(totalSize / 1024 / 1024).toFixed(0)}MB，超过缓存上限` };
            }
            const payload = relevant.map(e => ({
                file: e.file,
                folderPath: e.folderPath || '',
                name: e.name,
                relPath: (e.folderPath ? e.folderPath + '/' : '') + e.name,
                v: 2
            }));
            try {
                let list = [];
                try { list = (await idbGet(KEY_CACHED_LIST)) || []; } catch { list = []; }
                list = list.filter(r => r && r.name !== rootName);
                list.push({ name: rootName, files: payload, savedAt: Date.now() });
                await idbSet(KEY_CACHED_LIST, list);
                // legacy single-root keys (last added)
                await idbSet(KEY_CACHED_FILES, payload);
                await idbSet(KEY_CACHED_NAME, rootName);
                return { ok: true, count: payload.length, totalRoots: list.length };
            } catch (err) {
                console.warn('Cache write failed', err);
                return { ok: false, reason: '写入浏览器存储失败' };
            }
        }

        function normalizeCachedEntries(rawFiles) {
            return (rawFiles || []).map(item => {
                if (item && item.file && typeof item.name === 'string') {
                    return { file: item.file, folderPath: item.folderPath || '', name: item.name };
                }
                const f = item;
                const rel = (f && (f.webkitRelativePath || f.name)) || '';
                const p = rel.split('/');
                return {
                    file: f,
                    folderPath: p.length > 1 ? p.slice(0, -1).join('/') : '',
                    name: p[p.length - 1] || 'file'
                };
            });
        }

        btnSelectFolder.addEventListener('click', async () => {
            unlockIOSAudio();
            if (supportsFSA) {
                try {
                    const dirHandle = await window.showDirectoryPicker();
                    btnSelectFolder.disabled = true;
                    const prevLabel = btnSelectFolder.textContent;
                    btnSelectFolder.textContent = '读取目录中…';
                    try {
                        const entries = await collectFSAEntries(dirHandle);
                        const tree = buildTreeFromEntries(dirHandle.name, entries);
                        const isFirst = mediaRoots.length === 0;
                        if (isFirst) clearPlaybackState();
                        // ADD to list — do not wipe previous roots
                        adoptTree(tree, {
                            autoplay: isFirst,
                            resetPath: true,
                            add: !isFirst,
                            dirHandle,
                            source: 'fsa'
                        });
                        await persistDirHandleList();
                        await idbSet(KEY_NAME, dirHandle.name);
                        btnRestoreFolder.hidden = true;
                        setStatus(`已添加「${dirHandle.name}」· 共 ${countRootsTracks()} 首 / ${mediaRoots.length} 个目录`);
                    } finally {
                        btnSelectFolder.disabled = false;
                        btnSelectFolder.textContent = mediaRoots.length ? '添加目录' : '选择本地音频目录';
                        if (serverMode) btnSelectFolder.textContent = '添加本地目录';
                    }
                } catch (err) {
                    if (err && err.name === 'AbortError') return;
                    console.warn('Picker failed, fallback', err);
                    folderInput.click();
                }
            } else {
                folderInput.click();
            }
        });

        function autoPlayFirstAvailable() {
            if (!mediaTree || !mediaRoots.length) return;
            const target = mediaRoots[mediaRoots.length - 1].displayName || mediaRoots[mediaRoots.length - 1].name;
            currentPath = [target];
            const node = getNodeAtPath(mediaTree, currentPath);
            if (!node) {
                currentPath = [];
                renderBrowser();
                return;
            }
            renderBrowser();

            const sortedFolders = [...node.children.keys()].sort(compareNames);
            for (const name of sortedFolders) {
                const child = node.children.get(name);
                if (child.tracks.length) {
                    currentPath = currentPath.concat(name);
                    renderBrowser();
                    playTrack(0);
                    return;
                }
            }
            if (node.tracks.length) playTrack(0);
        }

        btnRestoreFolder.addEventListener('click', async () => {
            unlockIOSAudio();
            try {
                const dirHandle = await idbGet(KEY_DIR);
                if (!dirHandle) {
                    btnRestoreFolder.hidden = true;
                    return;
                }
                const ok = await ensureDirPermission(dirHandle, true);
                if (!ok) {
                    setStatus('未获得目录访问权限');
                    return;
                }
                btnRestoreFolder.disabled = true;
                btnRestoreFolder.textContent = '读取中…';
                try {
                    const entries = await collectFSAEntries(dirHandle);
                    const tree = buildTreeFromEntries(dirHandle.name, entries);
                    currentDirHandle = dirHandle;
                    await idbSet(KEY_NAME, dirHandle.name);
                    btnRestoreFolder.hidden = true;
                    adoptTree(tree, { autoplay: false, resetPath: true });
                    setStatus(`已恢复 ${folderTrackCount(tree)} 首`);
                } finally {
                    btnRestoreFolder.disabled = false;
                    btnRestoreFolder.textContent = '恢复上次目录';
                }
            } catch (err) {
                console.warn('Restore failed', err);
                setStatus('恢复失败，请重新选择目录');
            }
        });

        folderInput.addEventListener('change', async (e) => {
            unlockIOSAudio();
            const files = Array.from(e.target.files);
            if (!files.length) return;

            const { rootName, entries } = entriesFromWebkitFiles(files);
            const tree = buildTreeFromEntries(rootName, entries);
            const isFirst = mediaRoots.length === 0;
            if (isFirst) clearPlaybackState();

            adoptTree(tree, {
                autoplay: false,
                resetPath: true,
                add: !isFirst,
                dirHandle: null,
                source: 'webkit'
            });
            folderInput.value = '';

            // Always cache webkit picks (multi-root list) so reopen keeps ALL dirs
            if (entries.length) {
                setStatus('正在保存目录到浏览器…');
                const result = await cacheEntriesToIDB(entries, rootName);
                if (result.ok) {
                    btnClearCache.hidden = false;
                    setStatus(`已添加「${rootName}」· 共 ${countRootsTracks()} 首 / ${mediaRoots.length} 个目录 · 已记住`);
                    updateDirHint();
                } else {
                    setStatus(`已添加「${rootName}」· ${result.reason || '缓存失败'}`);
                }
            } else {
                setStatus(`已添加「${rootName}」· 共 ${countRootsTracks()} 首 / ${mediaRoots.length} 个目录`);
            }
            // Also persist FSA handles if any
            await persistDirHandleList();
            autoPlayFirstAvailable();
        });

        // ---------- Browser UI ----------
        function renderPathBar() {
            if (!mediaTree) {
                pathBar.hidden = true;
                return;
            }
            pathBar.hidden = false;
            pathBar.innerHTML = '';

            const rootBtn = document.createElement('button');
            rootBtn.type = 'button';
            rootBtn.className = 'path-seg' + (currentPath.length === 0 ? ' current' : '');
            const rootLabel = mediaTree.isVirtualRoot ? '全部目录' : (mediaTree.name || '根目录');
            rootBtn.textContent = rootLabel;
            rootBtn.title = rootLabel;
            if (currentPath.length > 0) {
                rootBtn.addEventListener('click', () => {
                    currentPath = [];
                    renderBrowser();
                });
            }
            pathBar.appendChild(rootBtn);

            currentPath.forEach((seg, i) => {
                const sep = document.createElement('span');
                sep.className = 'path-sep';
                sep.textContent = '›';
                pathBar.appendChild(sep);

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'path-seg' + (i === currentPath.length - 1 ? ' current' : '');
                btn.textContent = seg;
                btn.title = seg;
                if (i < currentPath.length - 1) {
                    btn.addEventListener('click', () => {
                        currentPath = currentPath.slice(0, i + 1);
                        renderBrowser();
                    });
                }
                pathBar.appendChild(btn);
            });
        }

        function subtitleBadgeHtml(track) {
            if (track.subType === 'srt') return '<span class="badge badge-srt">SRT</span>';
            return '<span class="badge badge-none">无字幕</span>';
        }

        function renderBrowser() {
            renderPathBar();
            trackListEl.innerHTML = '';

            if (!mediaTree) {
                trackListEl.innerHTML = `
                    <li class="empty-state">
                        <div class="empty-icon">🎧</div>
                        <strong>选择一个文件夹开始</strong>
                        支持同名的 .srt 字幕文件
                    </li>`;
                trackMetaEl.hidden = true;
                currentFolderTracks = [];
                return;
            }

            const node = getNodeAtPath(mediaTree, currentPath);
            if (!node) {
                currentPath = [];
                renderBrowser();
                return;
            }

            currentFolderTracks = node.tracks;
            const folderNames = [...node.children.keys()].sort(compareNames);
            const doneCount = countCompletedIn(node);
            const totalAll = folderTrackCount(node);

            trackMetaEl.hidden = false;
            if (node.isVirtualRoot) {
                trackMetaEl.textContent = `${folderNames.length} 个文件夹 · 共 ${totalAll} 首`;
            } else {
                const folderPart = folderNames.length ? `${folderNames.length} 个子文件夹 · ` : '';
                trackMetaEl.textContent =
                    `${folderPart}本层 ${node.tracks.length} 首 · 已完成 ${doneCount} · 共 ${totalAll} 首`;
            }

            // Parent up row when not at root
            if (currentPath.length > 0) {
                const up = document.createElement('li');
                up.className = 'track-item folder-item';
                up.innerHTML = `
                    <span class="track-icon">↩</span>
                    <div class="track-body">
                        <div class="track-name">返回上一级</div>
                        <div class="track-sub">${escapeHtml(currentPath.slice(0, -1).join(' / ') || mediaTree.name)}</div>
                    </div>`;
                up.addEventListener('click', () => {
                    currentPath = currentPath.slice(0, -1);
                    renderBrowser();
                });
                trackListEl.appendChild(up);
            }

            // Folders
            folderNames.forEach(name => {
                const child = node.children.get(name);
                const count = folderTrackCount(child);
                const childDone = countCompletedIn(child);
                const li = document.createElement('li');
                li.className = 'track-item folder-item';
                li.innerHTML = `
                    <span class="track-icon">📁</span>
                    <div class="track-body">
                        <div class="track-name"></div>
                        <div class="track-sub"></div>
                    </div>
                    <span class="badge badge-none">${count} 首</span>`;
                li.querySelector('.track-name').textContent = name;
                li.querySelector('.track-sub').textContent =
                    childDone > 0 ? `已完成 ${childDone}/${count}` : `${count} 首音频`;
                li.addEventListener('click', () => {
                    currentPath = currentPath.concat(name);
                    renderBrowser();
                });
                trackListEl.appendChild(li);
            });

            // Virtual root: only the selected folder(s) — no flat track dump
            if (node.isVirtualRoot) {
                if (!folderNames.length) {
                    const empty = document.createElement('li');
                    empty.className = 'empty-state';
                    empty.innerHTML = `
                        <div class="empty-icon">📂</div>
                        <strong>没有可浏览的文件夹</strong>
                        请重新选择包含音频的目录`;
                    trackListEl.appendChild(empty);
                }
                return;
            }

            // Tracks
            node.tracks.forEach((track, idx) => {
                const li = document.createElement('li');
                const isActive = idx === currentTrackIdx;
                li.className = `track-item${isActive ? ' active' : ''}`;
                li.setAttribute('role', 'button');

                const done = completedSet.has(track.key);

                const num = document.createElement('span');
                num.className = 'track-num';
                num.textContent = done ? '✓' : String(idx + 1);
                if (done) {
                    num.style.color = 'var(--success)';
                    num.style.fontWeight = '700';
                }

                const body = document.createElement('div');
                body.className = 'track-body';
                const nameEl = document.createElement('div');
                nameEl.className = 'track-name';
                nameEl.textContent = track.title;
                nameEl.title = track.title;
                const subEl = document.createElement('div');
                subEl.className = 'track-sub';
                subEl.textContent = track.subType === 'srt' ? 'SRT 字幕' : '无字幕文件';
                body.appendChild(nameEl);
                body.appendChild(subEl);

                const badgeWrap = document.createElement('span');
                badgeWrap.innerHTML = subtitleBadgeHtml(track);

                const doneBtn = document.createElement('button');
                doneBtn.type = 'button';
                doneBtn.className = done ? 'badge badge-done' : 'badge badge-undone';
                doneBtn.textContent = done ? '已完成' : '标完成';
                doneBtn.title = done ? '点击取消完成标记' : '标记为已完成';
                doneBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    markTrackCompleted(track.key, !completedSet.has(track.key));
                    renderBrowser();
                });

                li.appendChild(num);
                li.appendChild(body);
                li.appendChild(badgeWrap.firstElementChild);
                li.appendChild(doneBtn);

                li.addEventListener('click', () => playTrack(idx));
                trackListEl.appendChild(li);
            });

            if (!folderNames.length && !node.tracks.length) {
                const empty = document.createElement('li');
                empty.className = 'empty-state';
                empty.innerHTML = `
                    <div class="empty-icon">📂</div>
                    <strong>此文件夹为空</strong>
                    可返回上一级或刷新目录`;
                trackListEl.appendChild(empty);
            }
        }

        function countCompletedIn(node) {
            let n = node.tracks.filter(t => completedSet.has(t.key)).length;
            for (const c of node.children.values()) n += countCompletedIn(c);
            return n;
        }

        function updateNowPlaying(track) {
            const label = track ? track.title : '—';
            if (nowPlayingTitle) nowPlayingTitle.textContent = label;
            document.title = track
                ? `${track.title} · 语言学习播放器`
                : '语言学习与音频复读播放器';
        }

        // ---------- Media Session (Lock screen / Control Center / Earphones) ----------
        function setupMediaSession() {
            if (!('mediaSession' in navigator)) return;
            try {
                navigator.mediaSession.setActionHandler('play', () => {
                    userWantsPlay = true;
                    cancelEchoPause();
                    smoothPlay().then(() => updatePlayPauseIcon()).catch(() => {});
                });
                navigator.mediaSession.setActionHandler('pause', () => {
                    userWantsPlay = false;
                    cancelEchoPause();
                    smoothPause().then(() => updatePlayPauseIcon());
                    setStatus('已暂停');
                });
                navigator.mediaSession.setActionHandler('previoustrack', () => {
                    playPrevTrack();
                });
                navigator.mediaSession.setActionHandler('nexttrack', () => {
                    playNextTrack(false);
                });
                navigator.mediaSession.setActionHandler('seekbackward', (details) => {
                    if (currentLrcData && currentLrcData.length > 0 && activeLineIndex > 0) {
                        playPrevLine();
                    } else {
                        const offset = (details && details.seekOffset) || 5;
                        audio.currentTime = Math.max(0, audio.currentTime - offset);
                    }
                });
                navigator.mediaSession.setActionHandler('seekforward', (details) => {
                    if (currentLrcData && currentLrcData.length > 0 && activeLineIndex < currentLrcData.length - 1) {
                        playNextLine();
                    } else {
                        const offset = (details && details.seekOffset) || 5;
                        audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + offset);
                    }
                });
                if ('seekto' in navigator.mediaSession) {
                    navigator.mediaSession.setActionHandler('seekto', (details) => {
                        if (details && details.seekTime !== undefined && Number.isFinite(details.seekTime)) {
                            audio.currentTime = details.seekTime;
                        }
                    });
                }
            } catch (err) {
                console.warn('mediaSession setup error:', err);
            }
        }

        function updateMediaSessionTrack(track) {
            if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
            try {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: track ? track.title : '语言学习播放器',
                    artist: '语言学习播放器',
                    album: rootDirName || '音频学习'
                });
                navigator.mediaSession.playbackState = 'playing';
            } catch (e) { /* ignore */ }
        }

        function syncMediaSessionState() {
            if (!('mediaSession' in navigator)) return;
            try {
                if (isPausingForEcho) {
                    navigator.mediaSession.playbackState = 'playing';
                } else {
                    navigator.mediaSession.playbackState = (audio.paused || audio.ended) ? 'paused' : 'playing';
                }
                if ('setPositionState' in navigator.mediaSession && Number.isFinite(audio.duration) && audio.duration > 0) {
                    navigator.mediaSession.setPositionState({
                        duration: audio.duration,
                        playbackRate: audio.playbackRate || 1,
                        position: Math.min(audio.duration, Math.max(0, audio.currentTime))
                    });
                }
            } catch (e) { /* ignore */ }
        }

        // ---------- Playback ----------
        async function playTrack(index) {
            if (index < 0 || index >= currentFolderTracks.length) return;
            unlockIOSAudio();

            currentTrackIdx = index;
            const track = currentFolderTracks[index];
            currentTrackKey = track.key;

            renderBrowser();
            resetControlState();
            sentenceEndArmed = true;
            updateNowPlaying(track);

            // Fully stop previous audio (avoids residual tail on mobile)
            stopAudioHard();
            if (objectUrl) {
                try { URL.revokeObjectURL(objectUrl); } catch { /* ignore */ }
                objectUrl = null;
            }

            // Local File blob or server URL
            if (track.audioUrl) {
                audio.src = track.audioUrl;
            } else if (track.audioFile) {
                objectUrl = URL.createObjectURL(track.audioFile);
                audio.src = objectUrl;
            } else {
                setStatus('无法打开该音频');
                return;
            }
            try { audio.load(); } catch { /* ignore */ }

            // Immediately start playing synchronously within the user gesture
            userWantsPlay = true;
            updateMediaSessionTrack(track);
            closeSidebarOnMobileAfterPick();
            smoothPlay().then(() => updatePlayPauseIcon()).catch(() => {});
            updatePlayPauseIcon();

            // Fetch subtitles asynchronously in parallel
            let subText = null;
            let subLabel = '';
            try {
                if (track.subUrl) {
                    const res = await fetch(track.subUrl, { cache: 'no-cache' });
                    if (res.ok) subText = await res.text();
                    subLabel = '字幕';
                } else if (track.subFile) {
                    subText = await track.subFile.text();
                    subLabel = track.subFile.name || '字幕';
                }
            } catch (err) {
                console.error('Subtitle load failed:', err);
                subText = null;
            }

            // Only update subtitles if track hasn't switched during fetch
            if (currentTrackIdx !== index) return;

            if (subText != null && subText !== '') {
                currentLrcData = parseSRT(subText);
                if (currentLrcData.length) {
                    renderLyrics();
                } else {
                    lyricsContainer.innerHTML = `
                        <div class="lyrics-empty">
                            <strong>字幕文件已找到，但未能解析出内容</strong>
                            请检查 ${escapeHtml(subLabel)} 的格式是否正确
                        </div>`;
                }
                if (btnTranscribe) btnTranscribe.hidden = true;
            } else {
                currentLrcData = [];
                lyricsContainer.innerHTML = `
                    <div class="lyrics-empty">
                        <strong>此音频无对应字幕</strong>
                        ${serverMode ? '打开设置 ⚙ →「转录字幕」由服务器生成 SRT' : '在同一文件夹放置同名的 .srt 文件即可自动识别'}
                    </div>`;
            }

            updateTranscribeBtn(track);
            activeLineIndex = -1;
        }

        function closeSidebarOnMobileAfterPick() {
            if (window.matchMedia('(max-width: 768px)').matches) {
                closeSidebar();
            }
        }

        function escapeHtml(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        // ---------- Parsers ----------
        function parseSRT(text) {
            const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
            if (!normalized) return [];
            const blocks = normalized.split(/\n\s*\n/);
            const result = [];
            const timeRe = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;
            for (const block of blocks) {
                const lines = block.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0);
                if (lines.length < 2) continue;
                let timeIdx = lines.findIndex(l => l.includes('-->'));
                if (timeIdx === -1) continue;
                const m = lines[timeIdx].match(timeRe);
                if (!m) continue;
                const start = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4].padEnd(3, '0')) / 1000;
                const end = (+m[5]) * 3600 + (+m[6]) * 60 + (+m[7]) + (+m[8].padEnd(3, '0')) / 1000;
                const cueText = lines.slice(timeIdx + 1)
                    .map(l => l.replace(/<[^>]+>/g, '').trim())
                    .join(' ')
                    .trim();
                if (cueText) result.push({ time: start, endTime: end, text: cueText });
            }
            result.sort((a, b) => a.time - b.time);
            fillEndTimes(result, true);
            return result;
        }

        function fillEndTimes(result, keepExisting = false) {
            for (let i = 0; i < result.length; i++) {
                if (keepExisting && Number.isFinite(result[i].endTime) && result[i].endTime > result[i].time) {
                    continue;
                }
                if (i < result.length - 1) {
                    result[i].endTime = Math.max(result[i + 1].time, result[i].time + 0.05);
                } else {
                    result[i].endTime = result[i].time + 5;
                }
            }
        }

        function renderLyrics() {
            lyricsContainer.innerHTML = '';
            currentLrcData.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = 'lyric-line';
                div.dataset.index = index;
                const textSpan = document.createElement('span');
                textSpan.className = 'text-content';
                textSpan.textContent = item.text || '♪ 间奏 ♪';
                div.appendChild(textSpan);
                div.addEventListener('click', () => {
                    if (lyricsContainer.classList.contains('hide-all')) {
                        div.classList.toggle('revealed');
                    } else {
                        jumpToLine(index);
                    }
                });
                lyricsContainer.appendChild(div);
            });
        }

        const BASE_HEAD_PREROLL = 0.15; // 150ms 舒适起音前置缓冲，消除突兀感与吞辅音

        function getSmartLineStartTime(index) {
            if (index < 0 || index >= currentLrcData.length) return 0;
            const currentLine = currentLrcData[index];
            if (index === 0) {
                return Math.max(0, currentLine.time - BASE_HEAD_PREROLL);
            }
            const prevLine = currentLrcData[index - 1];
            const prevEnd = prevLine ? prevLine.endTime : 0;
            const gap = currentLine.time - prevEnd;
            if (gap > 0.04) {
                // 有间隙：取最高 150ms 前置缓冲，保留至少 20ms 安全距离避免踩上一句尾音
                const safeOffset = Math.min(BASE_HEAD_PREROLL, Math.max(0, gap - 0.02));
                return Math.max(0, currentLine.time - safeOffset);
            }
            const safeOffset = Math.max(0, Math.min(BASE_HEAD_PREROLL * 0.3, gap * 0.5));
            return Math.max(0, currentLine.time - safeOffset);
        }

        function seekToLineIndex(index) {
            const line = currentLrcData[index];
            if (!line) return;
            const target = getSmartLineStartTime(index);
            suppressLineSwitchUntil = line.time;
            sentenceEndArmed = true;
            // Keep highlight on the target line even if playhead is still catching up
            if (index !== activeLineIndex) {
                activeLineIndex = index;
                currentRepeatCount = Math.max(0, currentRepeatCount);
                const lines = lyricsContainer.querySelectorAll('.lyric-line');
                lines.forEach((el, idx) => {
                    if (idx === index) {
                        el.classList.add('active');
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } else {
                        el.classList.remove('active');
                    }
                });
                updateStatusText();
            }
            smoothPlay(target);
        }

        function jumpToLine(index) {
            const line = currentLrcData[index];
            if (!line) return;
            resetControlState();
            sentenceEndArmed = true;
            // Mute before jumping so the current segment does not linger
            stopAudioHard();
            seekToLineIndex(index);
        }

        function getLineFinishTime(index) {
            const line = currentLrcData[index];
            const isLast = index === currentLrcData.length - 1;
            // Use calibrated endTime from SRT
            if (isLast && Number.isFinite(audio.duration) && audio.duration > 0) {
                return Math.min(line.endTime, Math.max(line.time + 0.4, audio.duration - 0.05));
            }
            return line.endTime;
        }

        function effectiveRepeat() {
            if (studyMode === 'normal') return 1;
            return parseInt(repeatTimesSelect.value, 10) || 2;
        }
        function effectivePauseRatio() {
            if (studyMode === 'normal') return 0;
            return parseFloat(pauseRatioSelect.value) || 0;
        }
        function setHideAllLyrics(hide) {
            if (!lyricsContainer || !btnToggleLyrics) return;
            const on = !!hide;
            lyricsContainer.classList.toggle('hide-all', on);
            btnToggleLyrics.classList.toggle('active', on);
            btnToggleLyrics.textContent = on ? '显示全部歌词' : '隐藏全部歌词';
            lyricsContainer.querySelectorAll('.lyric-line').forEach(line => {
                line.classList.remove('revealed');
            });
        }

        function applyStudyModeUI() {
            const adv = studyMode === 'shadow' || studyMode === 'deep';
            if (btnStudyMode) {
                btnStudyMode.textContent = STUDY_MODE_LABELS[studyMode] || '正常播放';
                btnStudyMode.classList.toggle('active', adv);
            }
            // Nested under 学习模式: only in 跟读 / 深度跟读
            if (studyModeChildren) studyModeChildren.hidden = !adv;
        }
        function toggleStudyMode() {
            const i = STUDY_MODE_ORDER.indexOf(studyMode);
            studyMode = STUDY_MODE_ORDER[(i + 1) % STUDY_MODE_ORDER.length];
            const def = STUDY_DEFAULTS[studyMode] || STUDY_DEFAULTS.normal;
            if (repeatTimesSelect) repeatTimesSelect.value = def.repeat;
            if (pauseRatioSelect) pauseRatioSelect.value = def.pause;
            setHideAllLyrics(def.hideLyrics);
            cancelEchoPause();
            applyStudyModeUI();
            setStatus('模式 · ' + STUDY_MODE_LABELS[studyMode]);
            updateStatusText();
        }
        if (btnStudyMode) btnStudyMode.addEventListener('click', () => toggleStudyMode());
        applyStudyModeUI();

        function handleSentenceEnd(line) {
            const maxRepeat = effectiveRepeat();
            const pauseRatio = effectivePauseRatio();
            sentenceEndArmed = false;
            currentRepeatCount++;
            if (currentRepeatCount < maxRepeat) {
                handleSentenceRepeat(line, pauseRatio);
                return true;
            }
            currentRepeatCount = 0;
            if (pauseRatio > 0) {
                handlePauseThenProceed(line);
                return true;
            }
            return false;
        }

        // Sentence sync tick — rAF for foreground (smooth), setInterval so
        // background tabs still drive shadowing/repeat (rAF is suspended there).
        function playbackTick() {
            if (audio.paused || isPausingForEcho || !currentLrcData.length) return;

            const cur = audio.currentTime;

            if (activeLineIndex !== -1 && sentenceEndArmed) {
                const line = currentLrcData[activeLineIndex];
                const finishAt = getLineFinishTime(activeLineIndex);
                const nearThisLine =
                    cur >= line.time - 0.35 &&
                    cur <= finishAt + 0.9;
                const jumpedFar = cur > finishAt + 0.9;

                if (nearThisLine && cur >= finishAt) {
                    const consumed = handleSentenceEnd(line);
                    if (consumed) return;
                } else if (jumpedFar) {
                    sentenceEndArmed = false;
                    let idx = currentLrcData.findIndex(
                        (l) => cur >= l.time && cur < l.endTime
                    );
                    if (idx >= 0 && idx !== activeLineIndex) {
                        updateActiveLine(idx);
                    } else if (idx >= 0) {
                        sentenceEndArmed = true;
                    }
                }
            }

            if (!(suppressLineSwitchUntil > 0 && cur < suppressLineSwitchUntil)) {
                suppressLineSwitchUntil = -1;
                let index = currentLrcData.findIndex(
                    (line) => cur >= line.time && cur < line.endTime
                );
                if (index === -1 && activeLineIndex !== -1 && cur >= currentLrcData[activeLineIndex].time) {
                    index = activeLineIndex;
                }
                if (index !== -1 && index !== activeLineIndex) {
                    updateActiveLine(index);
                }
            }

            if (activeLineIndex !== -1) {
                const finishAt = getLineFinishTime(activeLineIndex);
                if (cur < finishAt - REARM_BEFORE_END) {
                    sentenceEndArmed = true;
                }
            }
        }

        function rafTick() {
            playbackTick();
            requestAnimationFrame(rafTick);
        }
        requestAnimationFrame(rafTick);
        setInterval(() => {
            // Shadowing pause deadline uses wall clock — finish even if tab throttled timers
            if (isPausingForEcho) completeEchoPauseIfDue();
            playbackTick();
        }, 100);
        // timeupdate keeps firing while <audio> plays, including some background tabs
        audio.addEventListener('timeupdate', () => {
            if (isPausingForEcho) completeEchoPauseIfDue();
            playbackTick();
        });

        audio.addEventListener('ended', () => {
            if (!currentLrcData.length) {
                finishTrackCompletely();
                return;
            }

            if (activeLineIndex !== -1 && sentenceEndArmed) {
                const consumed = handleSentenceEnd(currentLrcData[activeLineIndex]);
                if (consumed) return;
            }
            if (isPausingForEcho) return;

            finishTrackCompletely();
        });

        function finishTrackCompletely() {
            resetControlState();
            if (currentTrackKey) {
                markTrackCompleted(currentTrackKey, true);
                renderBrowser();
            }
            // Follow play mode after a natural finish
            if (playMode === 'one') {
                if (currentTrackIdx >= 0) {
                    playTrack(currentTrackIdx);
                    return;
                }
            } else if (playMode === 'loop') {
                playNextTrack(true);
                return;
            } else {
                // list: advance; stop if last
                const next = currentTrackIdx + 1;
                if (next < currentFolderTracks.length) {
                    playTrack(next);
                    return;
                }
            }
            setStatus('播放结束');
        }

        function updatePlayModeBtn() {
            if (btnPlayMode) {
                btnPlayMode.textContent = PLAY_MODE_LABELS[playMode] || '列表顺序';
                btnPlayMode.classList.toggle('active', playMode !== 'list');
            }
        }

        function cyclePlayMode() {
            const order = ['list', 'one', 'loop'];
            const i = order.indexOf(playMode);
            playMode = order[(i + 1) % order.length];
            updatePlayModeBtn();
            setStatus('模式 · ' + PLAY_MODE_LABELS[playMode]);
        }

        function playNextTrack(fromEnd = false) {
            if (!currentFolderTracks.length) return;
            const next = currentTrackIdx + 1;
            if (next < currentFolderTracks.length) {
                playTrack(next);
            } else if (playMode === 'loop' || fromEnd) {
                if (playMode === 'loop') playTrack(0);
                else if (!fromEnd) setStatus('已是最后一曲');
                else setStatus('播放结束');
            } else {
                setStatus('已是最后一曲');
            }
        }

        function playPrevTrack() {
            if (!currentFolderTracks.length) return;
            const prev = currentTrackIdx - 1;
            if (prev >= 0) {
                playTrack(prev);
            } else if (playMode === 'loop') {
                playTrack(currentFolderTracks.length - 1);
            } else {
                setStatus('已是第一曲');
            }
        }

        function playPrevLine() {
            if (!currentLrcData.length) return;
            cancelEchoPause();
            let idx = activeLineIndex;
            // If well into the current line, restart it; else go to previous
            if (idx >= 0 && Number.isFinite(audio.currentTime)) {
                const line = currentLrcData[idx];
                if (audio.currentTime - line.time > 0.6) {
                    jumpToLine(idx);
                    return;
                }
            }
            if (idx < 0) {
                // pick nearest line before playhead
                const cur = audio.currentTime;
                idx = currentLrcData.findIndex(l => cur < l.time) ;
                idx = idx <= 0 ? 0 : idx - 1;
            } else {
                idx = idx - 1;
            }
            if (idx < 0) {
                jumpToLine(0);
                setStatus('已是第一段');
                return;
            }
            jumpToLine(idx);
        }

        function playNextLine() {
            if (!currentLrcData.length) return;
            cancelEchoPause();
            let idx = activeLineIndex;
            if (idx < 0) {
                const cur = audio.currentTime;
                idx = currentLrcData.findIndex(l => cur < l.time);
                if (idx < 0) idx = currentLrcData.length - 1;
            } else {
                idx = idx + 1;
            }
            if (idx >= currentLrcData.length) {
                setStatus('已是最后一段');
                return;
            }
            jumpToLine(idx);
        }

        if (btnNextTrack) btnNextTrack.addEventListener('click', () => playNextTrack(false));
        if (btnPrevTrack) btnPrevTrack.addEventListener('click', () => playPrevTrack());
        if (btnPrevLine) btnPrevLine.addEventListener('click', () => playPrevLine());
        if (btnNextLine) btnNextLine.addEventListener('click', () => playNextLine());
        if (btnPlayMode) btnPlayMode.addEventListener('click', () => cyclePlayMode());
        updatePlayModeBtn();

        function handleSentenceRepeat(line, pauseRatio) {
            const idx = activeLineIndex;
            if (pauseRatio > 0) {
                pauseAndResume(() => { seekToLineIndex(idx); }, line);
            } else {
                seekToLineIndex(idx);
            }
            updateStatusText();
        }

        function handlePauseThenProceed(line) {
            const fromIdx = activeLineIndex;
            pauseAndResume(() => {
                const nextIndex = fromIdx + 1;
                const next = currentLrcData[nextIndex];
                if (next) {
                    seekToLineIndex(nextIndex);
                } else {
                    applySeek(line.endTime + 0.05);
                    smoothPlay();
                }
            }, line);
        }

        async function pauseAndResume(callback, line) {
            cancelEchoPause();
            const gen = ++echoGen;
            isPausingForEcho = true;
            userWantsPlay = false;
            await smoothPause();
            if (gen !== echoGen) return;

            // Keep iOS Safari awake & timers ticking while screen is locked
            try {
                const bg = getBgSilentAudio();
                bg.play().catch(() => {});
            } catch { /* ignore */ }

            const duration = Math.max(0.3, line.endTime - line.time);
            const ratio = effectivePauseRatio();
            const waitTimeMs = duration * ratio * 1000;
            echoCallback = callback;
            echoDeadline = Date.now() + waitTimeMs;
            setStatus('跟读停顿中…');

            const scheduleEchoCheck = () => {
                if (gen !== echoGen || !isPausingForEcho) return;
                if (Date.now() >= echoDeadline) {
                    completeEchoPauseIfDue();
                    return;
                }
                // Poll often in foreground; browser may stretch this in background
                const remain = echoDeadline - Date.now();
                pauseTimer = setTimeout(scheduleEchoCheck, Math.min(200, Math.max(50, remain)));
            };
            if (pauseTimer) clearTimeout(pauseTimer);
            scheduleEchoCheck();
        }

        function updateActiveLine(index) {
            activeLineIndex = index;
            currentRepeatCount = 0;
            sentenceEndArmed = true;
            const lines = lyricsContainer.querySelectorAll('.lyric-line');
            lines.forEach((el, idx) => {
                if (idx === index) {
                    el.classList.add('active');
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    el.classList.remove('active');
                }
            });
            updateStatusText();
        }

        function resetControlState() {
            cancelEchoPause();
            pauseTimer = null;
            intervalTimer = null;
            isPausingForEcho = false;
            currentRepeatCount = 0;
            activeLineIndex = -1;
            sentenceEndArmed = true;
            suppressLineSwitchUntil = -1;
            setStatus('就绪');
        }

        function updateStatusText() {
            const maxRepeat = effectiveRepeat();
            const total = currentLrcData.length;
            const pos = activeLineIndex >= 0 ? `${activeLineIndex + 1}/${total}` : '';
            if (maxRepeat > 1) {
                setStatus(`播放中 · 句 ${pos} · 第 ${currentRepeatCount + 1}/${maxRepeat} 次`);
            } else if (pos) {
                setStatus(`播放中 · 句 ${pos}`);
            } else {
                setStatus('播放中');
            }
        }

        btnToggleLyrics.addEventListener('click', () => {
            const isHidden = lyricsContainer.classList.toggle('hide-all');
            btnToggleLyrics.classList.toggle('active', isHidden);
            btnToggleLyrics.textContent = isHidden ? '显示全部歌词' : '隐藏全部歌词';
            lyricsContainer.querySelectorAll('.lyric-line').forEach(line => {
                line.classList.remove('revealed');
            });
        });

        function togglePlayPause() {
            unlockIOSAudio();
            if (audio.paused || audio.ended) {
                userWantsPlay = true;
                // Global play: drop any pending shadowing auto-resume silently
                cancelEchoPause();
                smoothPlay().then(() => updatePlayPauseIcon()).catch(() => {});
            } else {
                // Global pause: always wins over shadowing countdown
                userWantsPlay = false;
                cancelEchoPause();
                smoothPause().then(() => updatePlayPauseIcon());
                setStatus('已暂停');
            }
            updatePlayPauseIcon();
        }
        if (btnPlayPause) btnPlayPause.addEventListener('click', togglePlayPause);

        audio.addEventListener('pause', () => {
            updatePlayPauseIcon();
            syncMediaSessionState();
            // Echo flow pauses on purpose — only cancel when the USER pauses
            if (!isPausingForEcho) {
                cancelEchoPause();
            }
        });
        audio.addEventListener('play', () => {
            updatePlayPauseIcon();
            syncMediaSessionState();
            userWantsPlay = true;
            // User started playback during a shadowing countdown → abort auto-resume
            if (isPausingForEcho) {
                cancelEchoPause();
            }
        });
        audio.addEventListener('ended', () => {
            updatePlayPauseIcon();
            syncMediaSessionState();
        });
        audio.addEventListener('loadedmetadata', () => {
            if (timeDur) timeDur.textContent = formatClock(audio.duration);
            if (seekBar) seekBar.value = '0';
            if (timeCur) timeCur.textContent = '0:00';
            syncMediaSessionState();
        });
        audio.addEventListener('timeupdate', () => {
            if (timeCur) timeCur.textContent = formatClock(audio.currentTime);
            if (seekBar && Number.isFinite(audio.duration) && audio.duration > 0) {
                if (document.activeElement !== seekBar) {
                    seekBar.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
                }
            }
            syncMediaSessionState();
        });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                if (isPausingForEcho) {
                    completeEchoPauseIfDue();
                }
                syncMediaSessionState();
            }
        });
        setupMediaSession();
        if (seekBar) {
            seekBar.addEventListener('change', () => {
                if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
                cancelEchoPause();
                audio.currentTime = (Number(seekBar.value) / 1000) * audio.duration;
            });
        }

        document.addEventListener('keydown', (e) => {
            const tag = (e.target && e.target.tagName) || '';
            if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (!currentFolderTracks.length) return;

            if (e.code === 'Space') {
                e.preventDefault();
                togglePlayPause();
            } else if (e.code === 'ArrowLeft' && e.altKey) {
                e.preventDefault();
                playPrevTrack();
            } else if (e.code === 'ArrowRight' && e.altKey) {
                e.preventDefault();
                playNextTrack(false);
            } else if (e.key === '[') {
                e.preventDefault();
                playPrevLine();
            } else if (e.key === ']') {
                e.preventDefault();
                playNextLine();
            } else if (e.key === ',' || e.key === '，') {
                e.preventDefault();
                playPrevTrack();
            } else if (e.key === '.' || e.key === '。') {
                e.preventDefault();
                playNextTrack(false);
            }
        });

        async function restoreFsaRoots(into /* mediaRoots array to append */) {
            let handles = [];
            try {
                handles = (await idbGet(KEY_DIR_LIST)) || [];
                if (!handles.length) {
                    const single = await idbGet(KEY_DIR);
                    if (single) handles = [single];
                }
            } catch { handles = []; }
            let n = 0;
            for (const dirHandle of handles) {
                if (!dirHandle) continue;
                try {
                    const ok = await ensureDirPermission(dirHandle, false);
                    if (!ok) continue;
                    const entries = await collectFSAEntries(dirHandle);
                    const tree = buildTreeFromEntries(dirHandle.name, entries);
                    // skip if same name already present (e.g. server root collision)
                    if (into.some(r => r.name === dirHandle.name && r.source === 'fsa')) continue;
                    into.push({
                        id: 'fsa_' + dirHandle.name + '_' + n,
                        name: dirHandle.name,
                        tree,
                        dirHandle,
                        cached: false,
                        source: 'fsa'
                    });
                    n++;
                } catch { /* skip */ }
            }
            return n;
        }

        async function restoreCachedRoots(into) {
            let list = [];
            try { list = (await idbGet(KEY_CACHED_LIST)) || []; } catch { list = []; }
            if (!list.length) {
                // legacy single root
                try {
                    const cached = await idbGet(KEY_CACHED_FILES);
                    const cachedName = await idbGet(KEY_CACHED_NAME);
                    if (cached && cached.length) {
                        list = [{ name: cachedName || '浏览器缓存', files: cached }];
                    }
                } catch { /* ignore */ }
            }
            let n = 0;
            for (const item of list) {
                if (!item || !item.files || !item.files.length) continue;
                const entries = normalizeCachedEntries(item.files);
                const rootName = item.name || '浏览器缓存';
                if (into.some(r => r.name === rootName)) continue;
                const tree = buildTreeFromEntries(rootName, entries);
                into.push({
                    id: 'cache_' + rootName,
                    name: rootName,
                    tree,
                    dirHandle: null,
                    cached: true,
                    source: 'cache'
                });
                n++;
            }
            return n;
        }

        // ---------- Boot ----------
        (async function boot() {
            // 1) LAN server mode — then ALSO restore previously added local dirs
            if (location.protocol === 'http:' || location.protocol === 'https:') {
                try {
                    const { tree, rootName } = await loadServerTree();
                    serverMode = true;
                    serverRootName = rootName;
                    const roots = [{
                        id: 'server',
                        name: rootName,
                        tree,
                        dirHandle: null,
                        cached: false,
                        source: 'server'
                    }];
                    const fsaCount = await restoreFsaRoots(roots);
                    const cacheCount = await restoreCachedRoots(roots);
                    mediaRoots = roots;
                    rebuildVirtualRoot();
                    updateDirHint();
                    btnSelectFolder.textContent = fsaCount || cacheCount ? '添加目录' : '添加本地目录';
                    btnSelectFolder.title = '在服务器目录之外再添加本机文件夹';
                    btnRefresh.hidden = false;
                    btnRestoreFolder.hidden = true;
                    renderBrowser();
                    const extra = fsaCount + cacheCount;
                    setStatus(extra
                        ? `服务器模式 · 已恢复 ${extra} 个本地目录 · 共 ${countRootsTracks()} 首`
                        : `服务器模式 · ${folderTrackCount(tree)} 首 · 手机/电脑共用`);
                    return;
                } catch {
                    // not our server — fall through
                }
            }

            // 2) Local / file:// — restore ALL FSA handles
            if (supportsFSA) {
                const restored = [];
                const n = await restoreFsaRoots(restored);
                if (n > 0) {
                    mediaRoots = restored;
                    rebuildVirtualRoot();
                    updateDirHint();
                    btnSelectFolder.textContent = '添加目录';
                    btnRefresh.hidden = false;
                    btnRestoreFolder.hidden = true;
                    renderBrowser();
                    setStatus(`已恢复 ${n} 个目录 · ${countRootsTracks()} 首`);
                    return;
                }
            }

            // 3) Safari / webkit multi-cache
            const cachedRoots = [];
            const cn = await restoreCachedRoots(cachedRoots);
            if (cn > 0) {
                mediaRoots = cachedRoots;
                rebuildVirtualRoot();
                updateDirHint();
                btnSelectFolder.textContent = '添加目录';
                btnClearCache.hidden = false;
                btnRefresh.hidden = false;
                renderBrowser();
                setStatus(`已从缓存恢复 ${cn} 个目录 · ${countRootsTracks()} 首`);
                return;
            }

            if (!supportsFSA) {
                setDirHint('提示', '建议使用 server.py 局域网模式，或选择文件夹后会记住全部目录');
            }
        })();
    