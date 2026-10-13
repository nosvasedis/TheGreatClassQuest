let tonePromise;
let chartPromise;
let pdfPromise;

// Sound effects run next to heavy animations, so the audio context trades a few hundredths of a
// second of latency for a bigger output buffer: a busy laptop no longer crackles or drops out.
// Use Tone.getContext() / getTransport() / getDestination() everywhere: Tone's old `Tone.context`
// and `Tone.Transport` exports keep pointing at the default context this replaces.
function configureTone(Tone) {
    try {
        const old = Tone.getContext();
        if (old.latencyHint !== 'playback') {
            Tone.setContext(new Tone.Context({ latencyHint: 'playback', lookAhead: 0.1 }), true);
        }
        // A gentle limiter on the master output: when many effects stack up they are squeezed a little
        // instead of clipping into static.
        Tone.getDestination().chain(new Tone.Limiter(-1.5));
    } catch (error) {
        console.warn('Audio context setup skipped:', error);
    }
    return Tone;
}

export function loadTone() {
    if (!tonePromise) {
        tonePromise = import('tone').then(configureTone).catch((error) => {
            tonePromise = null;
            throw error;
        });
    }
    return tonePromise;
}

export function loadChart() {
    if (!chartPromise) {
        chartPromise = import('chart.js').then((module) => {
            const Chart = module.Chart;
            Chart.register(...module.registerables);
            window.Chart = Chart;
            return Chart;
        }).catch((error) => {
            chartPromise = null;
            throw error;
        });
    }
    return chartPromise;
}

export function loadPdfTools() {
    if (!pdfPromise) {
        pdfPromise = Promise.all([
            import('html2canvas'),
            import('jspdf'),
        ]).then(([canvasModule, pdfModule]) => {
            const html2canvas = canvasModule.default || canvasModule;
            const jsPDF = pdfModule.jsPDF || pdfModule.default?.jsPDF || pdfModule.default;
            window.html2canvas = html2canvas;
            window.jspdf = { ...(window.jspdf || {}), jsPDF };
            return { html2canvas, jsPDF };
        }).catch((error) => {
            pdfPromise = null;
            throw error;
        });
    }
    return pdfPromise;
}
