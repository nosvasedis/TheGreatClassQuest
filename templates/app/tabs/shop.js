// templates/app/tabs/shop.js

export const shopTabHTML = `
            <div id="shop-tab" class="app-tab hidden">
                <div class="max-w-7xl mx-auto px-3 sm:px-4">
                    <!-- Storefront: hanging shop sign -->
                    <header class="shop-tab-intro mm-facade">
                        <div class="mm-sign" aria-hidden="false">
                            <span class="mm-sign__chain mm-sign__chain--l" aria-hidden="true"></span>
                            <span class="mm-sign__chain mm-sign__chain--r" aria-hidden="true"></span>
                            <div class="mm-sign__board">
                                <span class="mm-sign__gem mm-sign__gem--l" aria-hidden="true"></span>
                                <span class="mm-sign__gem mm-sign__gem--r" aria-hidden="true"></span>
                                <span class="mm-sign__kicker">Relics · Treasures · Eggs</span>
                                <h2 id="shop-title" class="font-title mm-sign__title">Mystic Market</h2>
                                <span class="mm-sign__open" id="shop-open-sign"><i class="fas fa-door-open"></i> Open for trade</span>
                            </div>
                        </div>
                        <p id="shop-tagline" class="tab-sign__tagline mm-facade__tagline">
                            Pick a shopper, check their purse, then browse the shelves.
                        </p>
                    </header>

                    <!-- Unified shop shell: the shop itself -->
                    <div id="shop-window"
                        class="shop-window-shell mm-shop relative flex flex-col overflow-visible min-h-[520px]">

                        <!-- Striped awning + lanterns -->
                        <div class="mm-awning" aria-hidden="true">
                            <div class="mm-awning__canvas"></div>
                            <span class="mm-lantern mm-lantern--l"><span class="mm-lantern__glass"></span></span>
                            <span class="mm-lantern mm-lantern--r"><span class="mm-lantern__glass"></span></span>
                        </div>

                        <div class="absolute inset-0 mm-shop__bg pointer-events-none z-[1] rounded-[inherit]"></div>
                        <div class="absolute inset-0 opacity-[0.06] pointer-events-none shop-window-noise z-[1] rounded-[inherit]"></div>

                        <!-- Counter: shopkeeper · shopper · purse · restock -->
                        <div id="shop-command-deck" class="shop-command-deck mm-counter relative z-30 shrink-0">
                            <div class="mm-counter__inner">
                                <div class="mm-keeper" id="shop-keeper">
                                    <div class="mm-keeper__art" role="img" aria-label="The Market Keeper"></div>
                                    <div class="mm-keeper__bubble" id="shop-keeper-bubble" aria-live="polite">
                                        <span class="mm-keeper__name">The Market Keeper</span>
                                        <span class="mm-keeper__line" id="shop-keeper-line">Welcome, travellers! Choose a shopper and I'll open the till.</span>
                                    </div>
                                </div>
                            </div>

                            <!-- The wooden counter-front: restock on the left, the till (shopper + purse) and their Satchel on the right -->
                            <div class="mm-counter__bar">
                                <div class="mm-counter__controls" role="group" aria-label="Shopper, purse, satchel and restock">
                                    <button id="generate-shop-btn" type="button"
                                        class="hidden shop-restock-btn mm-restock-btn inline-flex items-center justify-center shrink-0"
                                        aria-label="Restock the shelves" data-tooltip="Restock the shelves">
                                        <i class="fas fa-sync-alt" aria-hidden="true"></i>
                                    </button>
                                    <!-- The till: who is shopping and what their purse holds, in one plaque.
                                         Tapping it unfolds the Shoppers' Ledger (ui/core/marketShopperLedger.js). -->
                                    <div class="mm-till" id="shop-till">
                                        <div class="shop-shopper mm-till__body" id="shop-shopper-root">
                                            <button type="button" id="shop-shopper-trigger" class="mm-till__shopper"
                                                aria-haspopup="listbox" aria-expanded="false" aria-controls="shop-shopper-listbox"
                                                aria-label="Choose a shopper">
                                                <span class="mm-till__face" id="shop-shopper-face"><span class="mm-face mm-face--empty" aria-hidden="true"><i class="fas fa-hat-wizard"></i></span></span>
                                                <span class="mm-till__who">
                                                    <span class="mm-till__label">Shopper</span>
                                                    <span class="mm-till__name" id="shop-shopper-display"><span class="mm-till__ph-long">Choose your adventurer…</span><span class="mm-till__ph-short">Tap to choose</span></span>
                                                </span>
                                                <span class="mm-till__chev" aria-hidden="true"><i class="fas fa-chevron-down"></i></span>
                                            </button>
                                            <span class="mm-till__seam" aria-hidden="true"><span></span><span></span></span>
                                            <div class="mm-till__purse" aria-live="polite">
                                                <span class="mm-till__pouch" aria-hidden="true"><i class="fas fa-coins"></i></span>
                                                <span class="mm-till__purse-body">
                                                    <span class="mm-till__label">Purse</span>
                                                    <span id="shop-student-gold" class="mm-till__gold">0 🪙</span>
                                                </span>
                                            </div>
                                            <div id="shop-shopper-listbox" class="mm-ledger" aria-hidden="true" inert></div>
                                        </div>
                                        <select id="shop-student-select" class="shop-shopper-native" tabindex="-1" aria-hidden="true">
                                            <option value="">Choose your adventurer…</option>
                                        </select>
                                    </div>
                                    <!-- The shopper's Satchel, hung beside the till: opens their relics and treasures.
                                         Without a shopper it unfolds the Shoppers' Ledger instead (ui/core/marketShopperLedger.js). -->
                                    <button type="button" id="shop-satchel-btn" class="mm-satchel"
                                        aria-label="Choose a shopper to open their Satchel" data-tooltip="Choose a shopper first">
                                        <span class="mm-satchel__art" aria-hidden="true">
                                            <svg viewBox="0 0 40 40" focusable="false">
                                                <path class="mm-satchel__strap" d="M11.5 16 C11.5 4.5 28.5 4.5 28.5 16" />
                                                <rect class="mm-satchel__bag" x="5.5" y="14" width="29" height="21" rx="5.5" />
                                                <path class="mm-satchel__seam" d="M8.5 31.5 H31.5" />
                                                <g class="mm-satchel__flap">
                                                    <path class="mm-satchel__flap-leather" d="M5.5 19 Q5.5 14 10.5 14 H29.5 Q34.5 14 34.5 19 V24.5 Q20 31 5.5 24.5 Z" />
                                                    <path class="mm-satchel__stitch" d="M8 18.5 Q8 16.4 10.6 16.4 H29.4 Q32 16.4 32 18.5 V23.2 Q20 28.6 8 23.2 Z" />
                                                    <rect class="mm-satchel__buckle" x="16.6" y="22.2" width="6.8" height="6.4" rx="1.4" />
                                                    <path class="mm-satchel__tongue" d="M20 22.2 V27" />
                                                </g>
                                                <circle class="mm-satchel__glint" cx="27" cy="9" r="1.6" />
                                            </svg>
                                        </span>
                                        <span class="mm-satchel__text">
                                            <span class="mm-satchel__label">Satchel</span>
                                            <span class="mm-satchel__count" id="shop-satchel-count">No shopper yet</span>
                                        </span>
                                        <span class="mm-satchel__badge" id="shop-satchel-badge" aria-hidden="true" hidden></span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Aisle signs: jump between departments, sort, filter by purse -->
                        <nav id="shop-aisles" class="mm-aisles relative z-20 hidden" aria-label="Market aisles">
                            <div class="mm-aisles__chips" id="shop-aisle-chips" role="toolbar" aria-label="Departments"></div>
                            <div class="mm-aisles__tools">
                                <label class="mm-aisles__sort">
                                    <i class="fas fa-sort-amount-down" aria-hidden="true"></i>
                                    <span class="sr-only">Sort wares</span>
                                    <select id="shop-sort-select">
                                        <option value="price-asc">Cheapest first</option>
                                        <option value="price-desc">Priciest first</option>
                                        <option value="name">A to Z</option>
                                    </select>
                                </label>
                                <button type="button" id="shop-afford-toggle" class="mm-aisles__afford" aria-pressed="false" disabled
                                    title="Choose a shopper first">
                                    <i class="fas fa-coins" aria-hidden="true"></i> <span>Can afford</span>
                                    <span class="mm-aisles__afford-count" id="shop-afford-count"></span>
                                </button>
                            </div>
                        </nav>

                        <!-- Catalog region (curtain / loader / shelves; the counter stays visible) -->
                        <div id="shop-catalog" class="shop-catalog relative flex-1 flex flex-col min-h-[380px] z-10 p-4 sm:p-6 md:p-8 pt-4 overflow-hidden">

                            <div class="absolute inset-0 pointer-events-none mm-catalog-backdrop" aria-hidden="true"></div>

                            <!-- Shop Curtain (shown when no class is selected, or the year is sealed) -->
                            <div id="shop-curtain" class="absolute inset-0 z-40 flex flex-col items-center justify-center overflow-hidden shop-catalog-overlay">
                                <div class="absolute inset-0 shop-curtain-bg"></div>
                                <div class="absolute inset-0 pointer-events-none shop-curtain-glow"></div>
                                <div class="mm-drapes" aria-hidden="true"><span></span><span></span></div>
                                <div class="relative z-10 text-center px-6 max-w-md mm-closed">
                                    <div class="mm-closed__sign">
                                        <span class="mm-closed__nail" aria-hidden="true"></span>
                                        <span class="mm-closed__word">Closed</span>
                                    </div>
                                    <div id="shop-curtain-icon" class="text-6xl sm:text-7xl mb-4 floating-icon shop-curtain-icon">🔮</div>
                                    <h3 id="shop-curtain-title" class="font-title text-3xl sm:text-4xl text-indigo-100 mb-2 tracking-tight">The Market Sleeps</h3>
                                    <p id="shop-curtain-message" class="text-indigo-300/85 text-base leading-relaxed">Pick a class from the header to lift the veil — then choose a shopper and browse the stalls.</p>
                                </div>
                            </div>

                            <!-- Shop Loader -->
                            <div id="shop-loader"
                                class="hidden absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0f0a2e]/85 backdrop-blur-md shop-catalog-overlay">
                                <div class="text-6xl sm:text-7xl animate-bounce mb-5 filter drop-shadow-[0_0_18px_rgba(217,70,239,0.45)]">🧙‍♂️</div>
                                <h3 class="font-title text-2xl sm:text-3xl text-amber-300 animate-pulse mb-2 text-center px-4">The Merchant is traveling…</h3>
                                <p class="text-indigo-200/90 text-center px-4">Procuring rare artifacts from the void.</p>
                            </div>

                            <!-- Empty State -->
                            <div id="shop-empty-state"
                                class="hidden flex flex-col items-center justify-center flex-1 min-h-[320px] text-center relative z-10 py-8">
                                <div class="text-7xl mb-5 opacity-35 grayscale filter drop-shadow-lg">📦</div>
                                <h3 class="font-title text-3xl text-indigo-200 mb-2">The Shelves Are Bare</h3>
                                <p class="text-indigo-400/90 mb-2 text-base max-w-md leading-relaxed">Nothing on display yet — the merchant will fill the stalls so heroes have something to save coins for.</p>
                                <p class="text-indigo-500/80 text-sm max-w-sm">New seasonal treasures arrive each month. Holiday treasures appear on the Festival Stall when a celebration is near.</p>
                            </div>

                            <!-- Shelves (one .mm-aisle per department) -->
                            <div id="shop-items-container" class="mm-shelves relative z-10">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- The Market Keeper follows shoppers down the shelves (ui/core/marketKeeperFloat.js) -->
                <div id="shop-keeper-float" class="mm-keeper-float" role="complementary" aria-label="The Market Keeper">
                    <div class="mm-keeper-float__bubble" aria-hidden="true" title="Hush the Market Keeper">
                        <span class="mm-keeper__name">The Market Keeper</span>
                        <span class="mm-keeper-float__line"></span>
                    </div>
                    <button type="button" class="mm-keeper-float__keeper" title="Choose a shopper"
                        aria-haspopup="listbox" aria-expanded="false" aria-controls="shop-keeper-ledger">
                        <span class="mm-keeper-float__art" aria-hidden="true"></span>
                        <span class="mm-keeper-float__ask" aria-hidden="true"><i class="fas fa-users"></i></span>
                    </button>
                    <div id="shop-keeper-ledger" class="mm-ledger mm-ledger--keeper" aria-hidden="true" inert></div>
                    <div class="mm-keeper-float__ledge">
                        <button type="button" class="mm-keeper-float__back" aria-label="Back to the counter" title="Back to the counter">
                            <span class="mm-keeper-float__purse">
                                <span class="mm-keeper-float__shopper"></span>
                                <span class="mm-keeper-float__coin" aria-hidden="true">🪙</span>
                                <span class="mm-keeper-float__gold"></span>
                            </span>
                            <span class="mm-keeper-float__up" aria-hidden="true"><i class="fas fa-arrow-up"></i></span>
                        </button>
                    </div>
                </div>
            </div>
`;
