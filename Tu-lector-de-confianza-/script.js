/* ============================================================
   VoiceRead — Totoro × Duolingo Theme
   Core Application Logic (Vanilla ES6+)
   ============================================================ */

(() => {
  'use strict';

  // ── Constants ──
  const MAX_CHARS = 5000;
  const WORDS_PER_MINUTE = 160;
  const SEEK_STEP = 0.10;
  const SCROLL_DEBOUNCE_MS = 200;
  const STORAGE_KEY = 'voiceread_prefs';

  // Application states
  const STATE = Object.freeze({
    IDLE: 'IDLE',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    STOPPED: 'STOPPED',
    COMPLETED: 'COMPLETED',
    ERROR: 'ERROR',
  });

  // Mascot images and messages for each state
  const MASCOT = Object.freeze({
    IDLE: {
      img: 'img/totoro-sleeping.png',
      alt: 'Totoro esperando',
      msg: '¡Escribe algo y presiona play para que te lo lea! 📖',
    },
    PLAYING: {
      img: 'img/totoro-speaking.png',
      alt: 'Totoro leyendo',
      msg: '¡Estoy leyendo para ti! 🎶',
    },
    PAUSED: {
      img: 'img/totoro-paused.png',
      alt: 'Totoro pausado',
      msg: 'Pausa... ¡Presiona play cuando quieras continuar! ⏸️',
    },
    STOPPED: {
      img: 'img/totoro-sleeping.png',
      alt: 'Totoro descansando',
      msg: '¡Listo para leer de nuevo! 🍃',
    },
    COMPLETED: {
      img: 'img/totoro-celebrate.png',
      alt: 'Totoro celebrando',
      msg: '¡Terminé de leer! 🎉 ¿Quieres escucharlo otra vez?',
    },
    ERROR: {
      img: 'img/totoro-confused.png',
      alt: 'Totoro confundido',
      msg: 'Algo salió mal... ¡Intenta con otra voz o texto! 😅',
    },
    EMPTY: {
      img: 'img/totoro-confused.png',
      alt: 'Totoro esperando texto',
      msg: 'Escribe o pega un texto para que pueda leértelo 📝',
    },
  });

  // ── App State ──
  const app = {
    state: STATE.IDLE,
    voices: [],
    currentUtterance: null,
    currentText: '',
    textOffset: 0,
    boundarySupported: true,
    lastBoundaryTime: 0,
    fallbackInterval: null,
    toastTimeout: null,
    scrollTimeout: null,
    wordElements: [],
    activeWordIndex: -1,
    progressDragging: false,
  };


  // ── DOM References ──
  const dom = {};

  function cacheDom() {
    dom.app = document.getElementById('app');
    dom.unsupportedOverlay = document.getElementById('unsupported-overlay');
    dom.textInput = document.getElementById('textInput');
    dom.btnClear = document.getElementById('btnClear');
    dom.charCount = document.getElementById('charCount');
    dom.charCounter = document.getElementById('charCounter');
    dom.counterFill = document.getElementById('counterFill');
    dom.statChars = document.getElementById('statChars');
    dom.statWords = document.getElementById('statWords');
    dom.statTime = document.getElementById('statTime');
    dom.displaySection = document.getElementById('displaySection');
    dom.displayPanel = document.getElementById('displayPanel');
    dom.displayPlaceholder = document.getElementById('displayPlaceholder');
    dom.displayText = document.getElementById('displayText');
    dom.readingBadge = document.getElementById('readingBadge');
    dom.progressBar = document.getElementById('progressBar');
    dom.progressFill = document.getElementById('progressFill');
    dom.progressHandle = document.getElementById('progressHandle');
    dom.progressPercent = document.getElementById('progressPercent');
    dom.progressPosition = document.getElementById('progressPosition');
    dom.btnRestart = document.getElementById('btnRestart');
    dom.btnStop = document.getElementById('btnStop');
    dom.btnPlayPause = document.getElementById('btnPlayPause');
    dom.btnSkipBack = document.getElementById('btnSkipBack');
    dom.btnSkipForward = document.getElementById('btnSkipForward');
    dom.iconPlay = document.getElementById('iconPlay');
    dom.iconPause = document.getElementById('iconPause');
    dom.voiceSelect = document.getElementById('voiceSelect');
    dom.voiceHint = document.getElementById('voiceHint');
    dom.rateSlider = document.getElementById('rateSlider');
    dom.rateValue = document.getElementById('rateValue');
    dom.pitchSlider = document.getElementById('pitchSlider');
    dom.pitchValue = document.getElementById('pitchValue');
    dom.statusDot = document.getElementById('statusDot');
    dom.statusLabel = document.getElementById('statusLabel');
    dom.toast = document.getElementById('toast');
    dom.toastMessage = document.getElementById('toastMessage');
    dom.btnClearStorage = document.getElementById('btnClearStorage');
    dom.mascotImg = document.getElementById('mascotImg');
    dom.speechBubble = document.getElementById('speechBubble');
    dom.bubbleText = document.getElementById('bubbleText');
  }


  // ── Browser Compatibility ──
  function checkBrowserSupport() {
    if (!('speechSynthesis' in window)) {
      dom.unsupportedOverlay.hidden = false;
      dom.app.style.display = 'none';
      return false;
    }
    return true;
  }


  // ══════════════════════════════════════════
  //  MASCOT MANAGEMENT
  // ══════════════════════════════════════════

  /**
   * Updates the mascot image, speech bubble text, and CSS animation class
   * based on the current app state.
   */
  function updateMascot(stateKey) {
    const mascot = MASCOT[stateKey] || MASCOT.IDLE;

    dom.mascotImg.src = mascot.img;
    dom.mascotImg.alt = mascot.alt;
    dom.bubbleText.textContent = mascot.msg;

    // Remove all animation classes
    dom.mascotImg.classList.remove('speaking', 'celebrating');

    // Apply state-specific animation
    if (stateKey === 'PLAYING') {
      dom.mascotImg.classList.add('speaking');
      dom.speechBubble.classList.add('active');
    } else if (stateKey === 'COMPLETED') {
      dom.mascotImg.classList.add('celebrating');
      dom.speechBubble.classList.remove('active');
    } else {
      dom.speechBubble.classList.remove('active');
    }
  }


  // ══════════════════════════════════════════
  //  VOICE MANAGEMENT
  // ══════════════════════════════════════════

  function loadVoices() {
    const rawVoices = speechSynthesis.getVoices();
    if (rawVoices.length === 0) return;

    app.voices = sortVoices(rawVoices);
    populateVoiceSelector();
  }

  function sortVoices(voices) {
    const priority = (lang) => {
      const l = lang.toLowerCase();
      if (l.startsWith('es')) return 0;
      if (l.startsWith('en')) return 1;
      return 2;
    };

    return [...voices].sort((a, b) => {
      const pa = priority(a.lang);
      const pb = priority(b.lang);
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name);
    });
  }

  function populateVoiceSelector() {
    const select = dom.voiceSelect;
    const savedVoiceName = getSavedPreference('voice');

    select.textContent = '';

    if (app.voices.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Las voces no están disponibles todavía...';
      select.appendChild(opt);
      dom.voiceHint.textContent = 'Intenta nuevamente en unos segundos.';
      return;
    }

    let selectedIndex = 0;

    app.voices.forEach((voice, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${voice.name} — ${voice.lang}`;
      select.appendChild(opt);

      if (savedVoiceName && voice.name === savedVoiceName) {
        selectedIndex = i;
      }
    });

    select.value = selectedIndex;
    updateVoiceHint(selectedIndex);
  }

  function updateVoiceHint(index) {
    const voice = app.voices[index];
    if (!voice) {
      dom.voiceHint.textContent = '';
      return;
    }
    const type = voice.localService ? '🏠 Local' : '☁️ En línea';
    dom.voiceHint.textContent = `${voice.lang} · ${type}`;
  }

  function getSelectedVoice() {
    const index = parseInt(dom.voiceSelect.value, 10);
    return app.voices[index] || null;
  }


  // ══════════════════════════════════════════
  //  TEXT STATISTICS
  // ══════════════════════════════════════════

  function updateStatistics() {
    const text = dom.textInput.value;
    const chars = text.length;
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    const rate = parseFloat(dom.rateSlider.value) || 1;
    const minutes = words / (WORDS_PER_MINUTE * rate);
    const timeStr = minutes < 1 ? '~0 min' : `~${Math.ceil(minutes)} min`;

    dom.charCount.textContent = chars;
    dom.statChars.textContent = `${chars} caracteres`;
    dom.statWords.textContent = `${words} palabras`;
    dom.statTime.textContent = timeStr;

    // Counter bar fill
    const pct = (chars / MAX_CHARS) * 100;
    dom.counterFill.style.width = pct + '%';

    // Warning states
    const counterText = dom.charCounter.querySelector('.counter-text');
    dom.counterFill.classList.remove('warning', 'limit');
    counterText.classList.remove('warning', 'limit');

    if (chars >= MAX_CHARS) {
      dom.counterFill.classList.add('limit');
      counterText.classList.add('limit');
    } else if (chars > MAX_CHARS * 0.9) {
      dom.counterFill.classList.add('warning');
      counterText.classList.add('warning');
    }
  }


  // ══════════════════════════════════════════
  //  DISPLAY PANEL — WORD-LEVEL RENDERING
  // ══════════════════════════════════════════

  function buildDisplayText(text) {
    dom.displayText.textContent = '';
    app.wordElements = [];
    app.activeWordIndex = -1;

    if (!text.trim()) return;

    const tokens = text.split(/(\s+)/);
    let charPos = 0;

    tokens.forEach((token) => {
      if (/\s+/.test(token)) {
        dom.displayText.appendChild(document.createTextNode(token));
        charPos += token.length;
      } else if (token.length > 0) {
        const span = document.createElement('span');
        span.className = 'word';
        span.textContent = token;
        span.dataset.start = charPos;
        span.dataset.end = charPos + token.length;
        dom.displayText.appendChild(span);
        app.wordElements.push(span);
        charPos += token.length;
      }
    });

    dom.displayPlaceholder.hidden = true;
    dom.displayText.hidden = false;
  }

  function highlightWordAtIndex(charIndex) {
    const absoluteIndex = charIndex + app.textOffset;
    let newActiveIndex = -1;

    for (let i = 0; i < app.wordElements.length; i++) {
      const start = parseInt(app.wordElements[i].dataset.start, 10);
      const end = parseInt(app.wordElements[i].dataset.end, 10);
      if (absoluteIndex >= start && absoluteIndex < end) {
        newActiveIndex = i;
        break;
      }
    }

    if (newActiveIndex === app.activeWordIndex) return;

    // Clear previous
    if (app.activeWordIndex >= 0 && app.wordElements[app.activeWordIndex]) {
      app.wordElements[app.activeWordIndex].classList.remove('active');
      app.wordElements[app.activeWordIndex].classList.add('spoken');
    }

    // Mark previous words as spoken
    for (let i = 0; i < newActiveIndex; i++) {
      app.wordElements[i].classList.add('spoken');
      app.wordElements[i].classList.remove('active');
    }

    // Set new active
    if (newActiveIndex >= 0 && app.wordElements[newActiveIndex]) {
      app.wordElements[newActiveIndex].classList.add('active');
      app.wordElements[newActiveIndex].classList.remove('spoken');
      scrollToWord(app.wordElements[newActiveIndex]);
    }

    app.activeWordIndex = newActiveIndex;
  }

  function scrollToWord(el) {
    if (app.scrollTimeout) return;

    const panel = dom.displayPanel;
    const elRect = el.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    if (elRect.top < panelRect.top || elRect.bottom > panelRect.bottom) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    app.scrollTimeout = setTimeout(() => {
      app.scrollTimeout = null;
    }, SCROLL_DEBOUNCE_MS);
  }

  function resetDisplay() {
    app.wordElements.forEach((el) => {
      el.classList.remove('active', 'spoken');
    });
    app.activeWordIndex = -1;
  }


  // ══════════════════════════════════════════
  //  PROGRESS
  // ══════════════════════════════════════════

  function updateProgress(charIndex) {
    const fullLength = app.currentText.length;
    if (fullLength === 0) return;

    const absolute = charIndex + app.textOffset;
    const pct = Math.min((absolute / fullLength) * 100, 100);

    dom.progressFill.style.width = pct + '%';
    dom.progressHandle.style.left = pct + '%';
    dom.progressPercent.textContent = Math.round(pct) + '%';
    dom.progressBar.setAttribute('aria-valuenow', Math.round(pct));
    dom.progressPosition.textContent = `${absolute} / ${fullLength}`;
  }

  function setProgress(pct) {
    pct = Math.max(0, Math.min(100, pct));
    dom.progressFill.style.width = pct + '%';
    dom.progressHandle.style.left = pct + '%';
    dom.progressPercent.textContent = Math.round(pct) + '%';
    dom.progressBar.setAttribute('aria-valuenow', Math.round(pct));
  }

  function resetProgress() {
    setProgress(0);
    dom.progressPosition.textContent = '—';
  }


  // ══════════════════════════════════════════
  //  FALLBACK PROGRESS
  // ══════════════════════════════════════════

  function startFallbackProgress() {
    stopFallbackProgress();

    const text = app.currentText;
    const rate = parseFloat(dom.rateSlider.value) || 1;
    const wordsCount = text.trim().split(/\s+/).length;
    const durationMs = (wordsCount / (WORDS_PER_MINUTE * rate)) * 60 * 1000;
    const steps = 100;
    const intervalMs = durationMs / steps;
    let step = Math.round((app.textOffset / text.length) * steps);

    app.fallbackInterval = setInterval(() => {
      if (app.state !== STATE.PLAYING) return;
      step++;
      if (step > steps) {
        stopFallbackProgress();
        return;
      }
      setProgress(step);
    }, intervalMs);
  }

  function stopFallbackProgress() {
    if (app.fallbackInterval) {
      clearInterval(app.fallbackInterval);
      app.fallbackInterval = null;
    }
  }


  // ══════════════════════════════════════════
  //  SPEECH SYNTHESIS
  // ══════════════════════════════════════════

  function createUtterance(text) {
    const utterance = new SpeechSynthesisUtterance(text);

    const voice = getSelectedVoice();
    if (voice) utterance.voice = voice;

    utterance.rate = parseFloat(dom.rateSlider.value) || 1;
    utterance.pitch = parseFloat(dom.pitchSlider.value) || 1;

    utterance.addEventListener('boundary', handleBoundary);
    utterance.addEventListener('start', handleStart);
    utterance.addEventListener('end', handleEnd);
    utterance.addEventListener('pause', handlePauseEvent);
    utterance.addEventListener('resume', handleResumeEvent);
    utterance.addEventListener('error', handleSpeechError);

    return utterance;
  }

  // ── Speech Event Handlers ──

  function handleBoundary(e) {
    if (e.name === 'word') {
      app.lastBoundaryTime = Date.now();
      highlightWordAtIndex(e.charIndex);
      updateProgress(e.charIndex);
    }
  }

  function handleStart() {
    setAppState(STATE.PLAYING);

    // Detect boundary support
    app.lastBoundaryTime = 0;
    setTimeout(() => {
      if (app.state === STATE.PLAYING && app.lastBoundaryTime === 0) {
        app.boundarySupported = false;
        startFallbackProgress();
      }
    }, 1500);
  }

  function handleEnd() {
    stopFallbackProgress();

    if (app.state === STATE.PLAYING) {
      setProgress(100);
      app.wordElements.forEach((el) => {
        el.classList.remove('active');
        el.classList.add('spoken');
      });
      setAppState(STATE.COMPLETED);
    }
  }

  function handlePauseEvent() { /* Browser-triggered */ }
  function handleResumeEvent() { /* Browser-triggered */ }

  function handleSpeechError(e) {
    stopFallbackProgress();
    if (e.error === 'interrupted' || e.error === 'canceled') return;
    console.warn('SpeechSynthesis error:', e.error);
    setAppState(STATE.ERROR);
    showToast('Error durante la reproducción. Intenta con otra voz.');
  }


  // ── Public Speech Controls ──

  function startSpeech() {
    const text = dom.textInput.value.trim();
    if (!text) {
      updateMascot('EMPTY');
      showToast('Escribe o pega un texto para comenzar.');
      return;
    }

    speechSynthesis.cancel();
    stopFallbackProgress();

    app.currentText = text;
    app.textOffset = 0;
    app.boundarySupported = true;

    buildDisplayText(text);
    resetProgress();

    const utterance = createUtterance(text);
    app.currentUtterance = utterance;
    speechSynthesis.speak(utterance);
  }

  function pauseSpeech() {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
      stopFallbackProgress();
      setAppState(STATE.PAUSED);
    }
  }

  function resumeSpeech() {
    if (speechSynthesis.paused) {
      speechSynthesis.resume();
      setAppState(STATE.PLAYING);
      if (!app.boundarySupported) {
        startFallbackProgress();
      }
    }
  }

  function stopSpeech() {
    speechSynthesis.cancel();
    stopFallbackProgress();
    resetDisplay();
    resetProgress();
    app.textOffset = 0;
    setAppState(STATE.STOPPED);

    setTimeout(() => {
      if (app.state === STATE.STOPPED) {
        setAppState(STATE.IDLE);
      }
    }, 300);
  }

  function restartSpeech() {
    speechSynthesis.cancel();
    stopFallbackProgress();
    resetDisplay();
    resetProgress();
    app.textOffset = 0;

    setTimeout(() => {
      startSpeech();
    }, 100);
  }

  /**
   * Seeks to a position by canceling current speech and creating a
   * new utterance from the sliced text at the target character offset.
   */
  function seekToPosition(percentage) {
    const text = app.currentText;
    if (!text) return;

    const targetIndex = Math.floor(text.length * (percentage / 100));
    const snappedIndex = snapToWordBoundary(text, targetIndex);

    speechSynthesis.cancel();
    stopFallbackProgress();

    app.textOffset = snappedIndex;
    app.boundarySupported = true;

    // Update display: mark words before offset as spoken
    app.wordElements.forEach((el) => {
      const start = parseInt(el.dataset.start, 10);
      el.classList.remove('active');
      if (start < snappedIndex) {
        el.classList.add('spoken');
      } else {
        el.classList.remove('spoken');
      }
    });
    app.activeWordIndex = -1;

    updateProgress(0);

    const remainingText = text.slice(snappedIndex);
    if (!remainingText.trim()) {
      setProgress(100);
      setAppState(STATE.COMPLETED);
      return;
    }

    const utterance = createUtterance(remainingText);
    app.currentUtterance = utterance;
    speechSynthesis.speak(utterance);
  }

  function snapToWordBoundary(text, index) {
    if (index <= 0) return 0;
    if (index >= text.length) return text.length;
    let i = index;
    while (i > 0 && !/\s/.test(text[i - 1])) {
      i--;
    }
    return i;
  }


  // ══════════════════════════════════════════
  //  APP STATE MANAGEMENT
  // ══════════════════════════════════════════

  function setAppState(newState) {
    app.state = newState;
    updateUI();
    updateMascot(newState);
  }

  function updateUI() {
    const s = app.state;
    const isPlaying = s === STATE.PLAYING;
    const isPaused = s === STATE.PAUSED;
    const isActive = isPlaying || isPaused;

    // Play/Pause icon
    dom.iconPlay.hidden = isPlaying;
    dom.iconPause.hidden = !isPlaying;

    // Play/Pause label
    if (isPlaying) {
      dom.btnPlayPause.setAttribute('aria-label', 'Pausar');
      dom.btnPlayPause.title = 'Pausar (Space)';
    } else {
      dom.btnPlayPause.setAttribute('aria-label', 'Reproducir');
      dom.btnPlayPause.title = 'Reproducir (Space)';
    }

    // Transport buttons
    dom.btnStop.disabled = !isActive;
    dom.btnRestart.disabled = !isActive && s !== STATE.COMPLETED;
    dom.btnSkipBack.disabled = !isActive;
    dom.btnSkipForward.disabled = !isActive;

    // Status indicator
    dom.statusDot.className = 'status-dot';
    switch (s) {
      case STATE.IDLE:
      case STATE.STOPPED:
        dom.statusLabel.textContent = 'Listo';
        dom.statusDot.classList.add('ready');
        break;
      case STATE.PLAYING:
        dom.statusLabel.textContent = 'Leyendo';
        dom.statusDot.classList.add('playing');
        break;
      case STATE.PAUSED:
        dom.statusLabel.textContent = 'Pausado';
        dom.statusDot.classList.add('paused');
        break;
      case STATE.COMPLETED:
        dom.statusLabel.textContent = '¡Listo!';
        dom.statusDot.classList.add('ready');
        break;
      case STATE.ERROR:
        dom.statusLabel.textContent = 'Error';
        dom.statusDot.classList.add('error');
        break;
    }

    // Reading badge
    dom.readingBadge.hidden = !isActive;
    if (isPaused) {
      dom.readingBadge.textContent = '⏸️ Pausado';
    } else if (isPlaying) {
      dom.readingBadge.textContent = '🔊 Leyendo';
    }
  }


  // ══════════════════════════════════════════
  //  PROGRESS BAR INTERACTION
  // ══════════════════════════════════════════

  function handleProgressClick(e) {
    if (!app.currentText) return;

    const rect = dom.progressBar.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));

    seekToPosition(pct);
  }

  function handleProgressDragStart(e) {
    if (!app.currentText) return;
    app.progressDragging = true;
    handleProgressClick(e);
    e.preventDefault();
  }

  function handleProgressDragMove(e) {
    if (!app.progressDragging) return;
    handleProgressClick(e);
    e.preventDefault();
  }

  function handleProgressDragEnd() {
    app.progressDragging = false;
  }


  // ══════════════════════════════════════════
  //  KEYBOARD SHORTCUTS
  // ══════════════════════════════════════════

  function handleKeyboard(e) {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'textarea' || tag === 'select' || tag === 'input') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'Escape':
        e.preventDefault();
        if (app.state === STATE.PLAYING || app.state === STATE.PAUSED) {
          stopSpeech();
        }
        break;
      case 'KeyR':
        e.preventDefault();
        if (app.state === STATE.PLAYING || app.state === STATE.PAUSED || app.state === STATE.COMPLETED) {
          restartSpeech();
        }
        break;
    }
  }


  // ══════════════════════════════════════════
  //  PLAY/PAUSE TOGGLE
  // ══════════════════════════════════════════

  function togglePlayPause() {
    switch (app.state) {
      case STATE.IDLE:
      case STATE.STOPPED:
      case STATE.COMPLETED:
        startSpeech();
        break;
      case STATE.PLAYING:
        pauseSpeech();
        break;
      case STATE.PAUSED:
        resumeSpeech();
        break;
    }
  }


  // ══════════════════════════════════════════
  //  TOAST NOTIFICATIONS
  // ══════════════════════════════════════════

  function showToast(message, durationMs = 3000) {
    dom.toastMessage.textContent = message;
    dom.toast.hidden = false;
    void dom.toast.offsetWidth;
    dom.toast.classList.add('visible');

    clearTimeout(app.toastTimeout);
    app.toastTimeout = setTimeout(() => {
      dom.toast.classList.remove('visible');
      setTimeout(() => {
        dom.toast.hidden = true;
      }, 300);
    }, durationMs);
  }


  // ══════════════════════════════════════════
  //  LOCAL STORAGE
  // ══════════════════════════════════════════

  function savePreferences() {
    try {
      const prefs = {
        text: dom.textInput.value,
        voice: getSelectedVoice()?.name || '',
        rate: dom.rateSlider.value,
        pitch: dom.pitchSlider.value,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch { /* fail silently */ }
  }

  function loadPreferences() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const prefs = JSON.parse(raw);

      if (prefs.text) dom.textInput.value = prefs.text;
      if (prefs.rate) {
        dom.rateSlider.value = prefs.rate;
        dom.rateValue.textContent = parseFloat(prefs.rate).toFixed(1) + 'x';
        dom.rateSlider.setAttribute('aria-valuenow', prefs.rate);
      }
      if (prefs.pitch) {
        dom.pitchSlider.value = prefs.pitch;
        dom.pitchValue.textContent = parseFloat(prefs.pitch).toFixed(1);
        dom.pitchSlider.setAttribute('aria-valuenow', prefs.pitch);
      }

      updateStatistics();
    } catch { /* fail silently */ }
  }

  function getSavedPreference(key) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw)[key] || null;
    } catch {
      return null;
    }
  }

  function clearStorage() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      showToast('¡Preferencias eliminadas! 🍃');
    } catch {
      showToast('No se pudieron borrar las preferencias.');
    }
  }


  // ══════════════════════════════════════════
  //  EVENT BINDINGS
  // ══════════════════════════════════════════

  function bindEvents() {
    // Voices
    speechSynthesis.addEventListener('voiceschanged', loadVoices);

    // Text input
    dom.textInput.addEventListener('input', () => {
      updateStatistics();
      savePreferences();
    });

    dom.btnClear.addEventListener('click', () => {
      if (app.state === STATE.PLAYING || app.state === STATE.PAUSED) {
        stopSpeech();
      }
      dom.textInput.value = '';
      updateStatistics();
      resetDisplay();
      dom.displayPlaceholder.hidden = false;
      dom.displayText.hidden = true;
      resetProgress();
      savePreferences();
      showToast('¡Texto eliminado! 🧹');
    });

    // Voice selector
    dom.voiceSelect.addEventListener('change', () => {
      const index = parseInt(dom.voiceSelect.value, 10);
      updateVoiceHint(index);
      savePreferences();
    });

    // Rate slider
    dom.rateSlider.addEventListener('input', () => {
      const val = parseFloat(dom.rateSlider.value).toFixed(1);
      dom.rateValue.textContent = val + 'x';
      dom.rateSlider.setAttribute('aria-valuenow', val);
      updateStatistics();
      savePreferences();
    });

    // Pitch slider
    dom.pitchSlider.addEventListener('input', () => {
      const val = parseFloat(dom.pitchSlider.value).toFixed(1);
      dom.pitchValue.textContent = val;
      dom.pitchSlider.setAttribute('aria-valuenow', val);
      savePreferences();
    });

    // Transport
    dom.btnPlayPause.addEventListener('click', togglePlayPause);
    dom.btnStop.addEventListener('click', stopSpeech);
    dom.btnRestart.addEventListener('click', restartSpeech);

    dom.btnSkipBack.addEventListener('click', () => {
      if (!app.currentText) return;
      const currentPct = (app.textOffset / app.currentText.length) * 100;
      seekToPosition(Math.max(0, currentPct - SEEK_STEP * 100));
    });

    dom.btnSkipForward.addEventListener('click', () => {
      if (!app.currentText) return;
      const currentPct = (app.textOffset / app.currentText.length) * 100;
      seekToPosition(Math.min(100, currentPct + SEEK_STEP * 100));
    });

    // Progress bar seek
    dom.progressBar.addEventListener('mousedown', handleProgressDragStart);
    dom.progressBar.addEventListener('touchstart', handleProgressDragStart, { passive: false });
    document.addEventListener('mousemove', handleProgressDragMove);
    document.addEventListener('touchmove', handleProgressDragMove, { passive: false });
    document.addEventListener('mouseup', handleProgressDragEnd);
    document.addEventListener('touchend', handleProgressDragEnd);

    // Keyboard on progress bar
    dom.progressBar.addEventListener('keydown', (e) => {
      if (!app.currentText) return;
      const currentPct = parseFloat(dom.progressBar.getAttribute('aria-valuenow')) || 0;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekToPosition(Math.min(100, currentPct + 5));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekToPosition(Math.max(0, currentPct - 5));
      }
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);

    // Clear storage
    dom.btnClearStorage.addEventListener('click', clearStorage);

    // Tab visibility: Chrome workaround
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && app.state === STATE.PLAYING && speechSynthesis.paused) {
        speechSynthesis.resume();
      }
    });

    window.addEventListener('beforeunload', () => {
      speechSynthesis.cancel();
    });

    // Chrome long-text workaround: periodically resume
    setInterval(() => {
      if (app.state === STATE.PLAYING && speechSynthesis.paused) {
        speechSynthesis.resume();
      }
    }, 10000);
  }


  // ══════════════════════════════════════════
  //  INITIALIZATION
  // ══════════════════════════════════════════

  function init() {
    cacheDom();

    if (!checkBrowserSupport()) return;

    loadPreferences();
    loadVoices();
    bindEvents();
    updateStatistics();
    updateMascot('IDLE');
    setAppState(STATE.IDLE);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
