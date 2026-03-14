// templates/subscribe.js
// Shown when tier is "pending" — school must subscribe before using the app.

export const subscribeHTML = `
    <div id="subscribe-screen"
        class="fixed inset-0 z-40 flex items-center justify-center p-4 hidden"
        style="background: linear-gradient(135deg, #c7d2fe 0%, #a5b4fc 100%);">
        <div class="w-full max-w-md bg-white p-8 rounded-3xl shadow-2xl text-center">
            <h1 class="font-title text-3xl text-indigo-700 mb-2">Subscribe to get started</h1>
            <p class="text-gray-600 mb-6">Choose a plan to unlock The Great Class Quest for your school.</p>
            <div id="subscribe-actions"></div>
            <p id="subscribe-refresh-hint" class="text-sm text-gray-500 mt-6 hidden">Refresh this page after you've completed payment.</p>
        </div>
    </div>
`;
