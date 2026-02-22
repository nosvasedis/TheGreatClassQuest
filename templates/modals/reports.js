// templates/modals/reports.js
// Report modal, certificate modal

export const reportsModalsHTML = `
    <div id="report-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-2xl w-full pop-in border-4 border-green-300">
            <div class="flex justify-between items-center mb-4">
                <h2 class="font-title text-2xl md:text-3xl text-green-700">Weekly Quest Report</h2>
                <button id="report-modal-close-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>
            <div id="report-modal-content"
                class="space-y-4 max-h-[70vh] overflow-y-auto pr-2 bg-green-50 p-4 rounded-lg"></div>
        </div>
    </div>

    <div id="certificate-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-2xl w-full pop-in border-4 border-indigo-300">
            <div class="flex justify-between items-center mb-4">
                <h2 class="font-title text-2xl md:text-3xl text-indigo-700">Certificate of Achievement</h2>
                <button id="certificate-modal-close-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>
            <div id="certificate-modal-content"
                class="space-y-4 max-h-[70vh] overflow-y-auto pr-2 bg-indigo-50 p-4 rounded-lg"></div>
            <button id="download-certificate-btn"
                class="w-full mt-4 bg-indigo-500 hover:bg-indigo-600 text-white font-title text-lg py-3 rounded-xl bubbly-button hidden">
                <i class="fas fa-download mr-2"></i> Download as PDF
            </button>
        </div>
    </div>
`;
