let tonePromise;
let chartPromise;
let pdfPromise;

export function loadTone() {
    if (!tonePromise) {
        tonePromise = import('tone').catch((error) => {
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
