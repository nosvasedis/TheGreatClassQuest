// /templates/modals/studentAnalytics.js
// The Scholar's Folio: one scholar's page of trials. Opens from the Honour Roll
// (Scholar's Scroll), the class roster and Hero stats.
// Rendering: ui/modals/studentAnalytics.js · styles: styles/student_analytics.css

export const studentAnalyticsModalHTML = `
    <div id="student-analytics-modal" class="sf-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="sf-name">
        <div class="sf-overlay__bg" data-sf-close></div>
        <div class="sf-card pop-in" id="sf-card">
            <header id="sf-head" class="sf-head"></header>
            <div class="sf-nav">
                <div class="sf-tabs" role="tablist" aria-label="Folio pages">
                    <button type="button" class="sf-tab is-active" role="tab" id="sf-tab-overview" data-sf-tab="overview" aria-selected="true" aria-controls="sf-panel-overview">
                        <i class="fas fa-feather-alt" aria-hidden="true"></i><span>Overview</span>
                    </button>
                    <button type="button" class="sf-tab" role="tab" id="sf-tab-trials" data-sf-tab="trials" aria-selected="false" aria-controls="sf-panel-trials" tabindex="-1">
                        <i class="fas fa-scroll" aria-hidden="true"></i><span>Trials</span><b class="sf-tab__count" id="sf-trial-count"></b>
                    </button>
                    <button type="button" class="sf-tab" role="tab" id="sf-tab-seals" data-sf-tab="seals" aria-selected="false" aria-controls="sf-panel-seals" tabindex="-1">
                        <i class="fas fa-stamp" aria-hidden="true"></i><span>Seals</span><b class="sf-tab__count" id="sf-seal-count"></b>
                    </button>
                    <button type="button" class="sf-tab" role="tab" id="sf-tab-oracle" data-sf-tab="oracle" aria-selected="false" aria-controls="sf-panel-oracle" tabindex="-1">
                        <i class="fas fa-hat-wizard" aria-hidden="true"></i><span>Oracle</span><i class="fas fa-lock sf-tab__lock" id="sf-oracle-lock" aria-hidden="true" hidden></i>
                    </button>
                </div>
                <div id="sf-range" class="sf-seg sf-range" role="group" aria-label="Period"></div>
            </div>
            <div class="sf-body" id="sf-body">
                <section id="sf-panel-overview" class="sf-panel" role="tabpanel" aria-labelledby="sf-tab-overview"></section>
                <section id="sf-panel-trials" class="sf-panel" role="tabpanel" aria-labelledby="sf-tab-trials" hidden></section>
                <section id="sf-panel-seals" class="sf-panel" role="tabpanel" aria-labelledby="sf-tab-seals" hidden></section>
                <section id="sf-panel-oracle" class="sf-panel" role="tabpanel" aria-labelledby="sf-tab-oracle" hidden></section>
            </div>
        </div>
    </div>
`;
