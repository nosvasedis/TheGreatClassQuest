// templates/modals/reports.js
// Report modal, certificate modal

export const reportsModalsHTML = `
    <div id="report-modal"
        class="wr-backdrop fixed inset-0 z-[70] flex items-center justify-center p-4 hidden"
        role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
        <div class="wr-shell pop-in">
            <header class="wr-head">
                <div class="wr-head__sky" aria-hidden="true"><span></span><span></span><span></span></div>
                <div class="wr-seal" aria-hidden="true"><span id="report-modal-logo">📚</span></div>
                <div class="wr-head__titles">
                    <p class="wr-kicker">The Week's Scroll</p>
                    <h2 id="report-modal-title" class="wr-title">Weekly Report</h2>
                    <p id="report-modal-sub" class="wr-sub"></p>
                </div>
                <div class="wr-weeknav" role="group" aria-label="Choose the week">
                    <button type="button" id="report-week-prev" class="wr-weeknav__btn" aria-label="Week before" title="Week before">
                        <i class="fas fa-chevron-left" aria-hidden="true"></i>
                    </button>
                    <div class="wr-weeknav__label" aria-live="polite">
                        <span id="report-week-name">This week</span>
                        <strong id="report-week-label"></strong>
                    </div>
                    <button type="button" id="report-week-next" class="wr-weeknav__btn" aria-label="Week after" title="Week after">
                        <i class="fas fa-chevron-right" aria-hidden="true"></i>
                    </button>
                </div>
                <button type="button" id="report-modal-close-btn" class="wr-close" aria-label="Close">&times;</button>
            </header>

            <div id="report-modal-content" class="wr-body custom-scrollbar"></div>

            <footer class="wr-foot">
                <p id="report-foot-hint" class="wr-foot__hint">Counted from your Quest Log: stars, Adventure Log, trials and attendance.</p>
                <div class="wr-foot__actions">
                    <button type="button" id="report-copy-btn" class="wr-btn wr-btn--ghost" disabled>
                        <i class="far fa-copy" aria-hidden="true"></i> Copy text
                    </button>
                    <button type="button" id="report-pdf-btn" class="wr-btn wr-btn--gold" disabled>
                        <i class="fas fa-file-pdf" aria-hidden="true"></i> Save PDF
                    </button>
                </div>
            </footer>
        </div>
    </div>

    <div id="certificate-modal"
        class="cert-folio-overlay fixed inset-0 z-[70] flex items-center justify-center p-4 hidden"
        role="dialog" aria-modal="true" aria-labelledby="certificate-modal-title">
        <div class="cert-folio pop-in">
            <div class="cert-folio__head">
                <div class="cert-folio__seal" aria-hidden="true"><i class="fas fa-award"></i></div>
                <div class="cert-folio__titles">
                    <p class="cert-folio__eyebrow">Hall of Honours</p>
                    <h2 id="certificate-modal-title" class="cert-folio__title">Hero Certificate</h2>
                    <p id="certificate-modal-student" class="cert-folio__student"></p>
                </div>
                <button id="certificate-modal-close-btn" type="button" class="cert-folio__close" aria-label="Close">&times;</button>
            </div>

            <div class="cert-folio__ribbons" role="tablist" aria-label="Certificate period">
                <button id="cert-tab-monthly" type="button" role="tab" class="cert-ribbon is-active" aria-selected="true">
                    <span class="cert-ribbon__icon" aria-hidden="true"><i class="fas fa-calendar-alt"></i></span>
                    <span class="cert-ribbon__text">
                        <span class="cert-ribbon__name">Monthly Quest</span>
                        <span class="cert-ribbon__hint">This month's deeds</span>
                    </span>
                </button>
                <button id="cert-tab-alltime" type="button" role="tab" class="cert-ribbon" aria-selected="false">
                    <span class="cert-ribbon__icon" aria-hidden="true"><i class="fas fa-crown"></i></span>
                    <span class="cert-ribbon__text">
                        <span class="cert-ribbon__name">Legend's Journey</span>
                        <span class="cert-ribbon__hint">The whole school year</span>
                    </span>
                </button>
            </div>

            <div id="certificate-modal-content" class="cert-folio__body custom-scrollbar">
                <!-- Desk (live page preview) and scribe's panel are rendered here -->
            </div>

            <div class="cert-folio__footer">
                <button id="download-certificate-btn" type="button" class="cert-btn cert-btn--seal hidden">
                    <i class="fas fa-stamp"></i> Seal &amp; Download PDF
                </button>
            </div>
        </div>
    </div>
`;
