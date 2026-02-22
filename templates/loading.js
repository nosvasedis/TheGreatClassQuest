// templates/loading.js

export const loadingHTML = `
    <div id="loading-screen"
        class="fixed inset-0 flex flex-col items-center justify-center z-[60] transition-opacity duration-500"
        style="background: linear-gradient(to bottom, #F0F9FF 0%, #E0F2FE 50%, #D6F9E3 100%);">

        <div class="relative flex items-center justify-center mb-8">
            <div class="loading-center-star">
                <i class="fas fa-star"></i>
            </div>
            <div class="loading-simple-ring"></div>
        </div>

        <div class="loading-text">Loading</div>
    </div>
`;
