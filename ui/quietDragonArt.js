// ui/quietDragonArt.js — the Quiet Dragon, drawn by hand in SVG (no emoji, no images).
// A moonlit dragon curled on its hoard. Every moving part is its own group so the stage
// (ui/modals/quietDragon.js + styles/quiet_dragon.css) can animate it with transform and
// opacity only: breathing, the wing lifting, the head rising, the eyes opening, the tail tip.
// The hoard pieces (data-hoard="1..8") start hidden and glint in as calm time builds up.

const ID = 'qd'; // gradient/pattern ids are prefixed so two dragons never collide

function defs() {
    return `
    <defs>
        <linearGradient id="${ID}-hide" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#2f7f8f"/>
            <stop offset=".45" stop-color="#1d5468"/>
            <stop offset="1" stop-color="#0d2b40"/>
        </linearGradient>
        <linearGradient id="${ID}-hide-dark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#1e5a6b"/>
            <stop offset="1" stop-color="#0a2133"/>
        </linearGradient>
        <radialGradient id="${ID}-rim" cx=".35" cy=".1" r=".9">
            <stop offset="0" stop-color="#8fe3e6" stop-opacity=".55"/>
            <stop offset=".45" stop-color="#8fe3e6" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="${ID}-belly" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#f6dc9a"/>
            <stop offset="1" stop-color="#c58d45"/>
        </linearGradient>
        <linearGradient id="${ID}-horn" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stop-color="#fff1cc"/>
            <stop offset=".55" stop-color="#e2b866"/>
            <stop offset="1" stop-color="#9c6a2c"/>
        </linearGradient>
        <linearGradient id="${ID}-wing" x1="0" y1="0" x2=".3" y2="1">
            <stop offset="0" stop-color="#3f3487"/>
            <stop offset=".6" stop-color="#2a2a68"/>
            <stop offset="1" stop-color="#191b47"/>
        </linearGradient>
        <radialGradient id="${ID}-wing-glow" cx=".5" cy=".95" r=".8">
            <stop offset="0" stop-color="#9b7cf0" stop-opacity=".35"/>
            <stop offset="1" stop-color="#9b7cf0" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="${ID}-spike" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stop-color="#b9823c"/>
            <stop offset="1" stop-color="#ffe3a3"/>
        </linearGradient>
        <radialGradient id="${ID}-iris" cx=".5" cy=".5" r=".6">
            <stop offset="0" stop-color="#fff3b0"/>
            <stop offset=".45" stop-color="#ffbe2e"/>
            <stop offset="1" stop-color="#d9631c"/>
        </radialGradient>
        <radialGradient id="${ID}-coin" cx=".35" cy=".3" r=".8">
            <stop offset="0" stop-color="#fff6c8"/>
            <stop offset=".5" stop-color="#f4c34d"/>
            <stop offset="1" stop-color="#a86c1c"/>
        </radialGradient>
        <linearGradient id="${ID}-gold-pile" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#ffd970"/>
            <stop offset=".5" stop-color="#d99a2b"/>
            <stop offset="1" stop-color="#6b3f12"/>
        </linearGradient>
        <linearGradient id="${ID}-rock" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#3a4466"/>
            <stop offset="1" stop-color="#151a30"/>
        </linearGradient>
        <radialGradient id="${ID}-gem-r" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffd1dc"/><stop offset=".5" stop-color="#ff3d6e"/><stop offset="1" stop-color="#8a0f35"/></radialGradient>
        <radialGradient id="${ID}-gem-b" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#d6f3ff"/><stop offset=".5" stop-color="#3db4ff"/><stop offset="1" stop-color="#0b4a8a"/></radialGradient>
        <radialGradient id="${ID}-gem-g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#d9ffe6"/><stop offset=".5" stop-color="#32d27a"/><stop offset="1" stop-color="#0c6136"/></radialGradient>
        <pattern id="${ID}-scales" width="22" height="16" patternUnits="userSpaceOnUse">
            <path d="M0 16 Q 5.5 6 11 16 M11 16 Q 16.5 6 22 16 M-5.5 8 Q 0 -2 5.5 8 M5.5 8 Q 11 -2 16.5 8 M16.5 8 Q 22 -2 27.5 8"
                fill="none" stroke="#bff3f0" stroke-opacity=".16" stroke-width="1.3"/>
        </pattern>
        <radialGradient id="${ID}-smoke" cx=".5" cy=".5" r=".5">
            <stop offset="0" stop-color="#e8f1ff" stop-opacity=".55"/>
            <stop offset="1" stop-color="#e8f1ff" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="${ID}-glint" cx=".5" cy=".5" r=".5">
            <stop offset="0" stop-color="#fffbe6"/>
            <stop offset=".3" stop-color="#ffe7a0" stop-opacity=".8"/>
            <stop offset="1" stop-color="#ffe7a0" stop-opacity="0"/>
        </radialGradient>
    </defs>`;
}

function sparkle(x, y, s = 1, cls = '') {
    return `<g class="qd-glint ${cls}" transform="translate(${x} ${y}) scale(${s})"><circle r="9" fill="url(#${ID}-glint)"/><path d="M0 -11 L1.6 -1.6 L11 0 L1.6 1.6 L0 11 L-1.6 1.6 L-11 0 L-1.6 -1.6 Z" fill="#fffbe6"/></g>`;
}

function coin(x, y, r = 11, tilt = 0) {
    return `<g transform="translate(${x} ${y}) rotate(${tilt})"><ellipse rx="${r}" ry="${r * 0.42}" fill="#8a5516"/><ellipse rx="${r}" ry="${r * 0.42}" cy="-2" fill="url(#${ID}-coin)"/><ellipse rx="${r * 0.62}" ry="${r * 0.24}" cy="-2" fill="none" stroke="#a86c1c" stroke-opacity=".55" stroke-width="1.2"/></g>`;
}

function gem(x, y, kind = 'r', s = 1) {
    return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-10 -4 L-5 -11 L5 -11 L10 -4 L0 10 Z" fill="url(#${ID}-gem-${kind})" stroke="#fff" stroke-opacity=".35" stroke-width="1"/><path d="M-10 -4 L10 -4 M-5 -11 L-2 -4 L0 10 M5 -11 L2 -4" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width=".8"/></g>`;
}

/** The hoard the dragon sleeps on: rocks and a bed of gold (the pieces that grow with calm time are in front). */
function hoard() {
    return `
    <g class="qd-hoard">
        <path d="M40 600 C 70 548 140 520 230 512 C 330 504 420 520 520 518 C 640 516 760 500 860 514 C 920 522 965 556 985 600 L 990 620 L 30 620 Z" fill="url(#${ID}-rock)"/>
        <path d="M95 600 C 130 566 210 548 300 546 C 420 543 520 553 640 549 C 760 545 850 548 905 600 L 910 620 L 90 620 Z" fill="url(#${ID}-gold-pile)"/>
        <path d="M120 600 C 170 578 250 568 330 568 C 450 567 560 575 680 571 C 780 568 850 575 885 600 Z" fill="#7a4814" opacity=".45"/>
        ${coin(170, 580, 12, -8)}${coin(222, 566, 10, 6)}${coin(820, 574, 12, 10)}${coin(868, 586, 10, -4)}
        ${coin(520, 585, 11, 0)}${coin(600, 578, 10, -10)}${coin(410, 586, 12, 8)}
    </g>`;
}

/** The front of the hoard: eight pieces that glint in, one by one, as calm time builds up. */
function hoardFront() {
    return `
    <g class="qd-hoard-front">
        <path d="M60 620 C 120 600 220 594 330 598 C 470 603 560 596 700 598 C 800 600 900 604 960 620 Z" fill="url(#${ID}-gold-pile)"/>
        ${coin(150, 606, 12, -6)}${coin(520, 610, 11, 4)}${coin(902, 610, 12, 8)}
        <g class="qd-hoard__piece" data-hoard="1">${coin(232, 602, 13, -6)}${coin(250, 594, 12, 8)}${coin(240, 586, 11, -2)}</g>
        <g class="qd-hoard__piece" data-hoard="2">${gem(760, 596, 'b', 1.25)}</g>
        <g class="qd-hoard__piece" data-hoard="3">${coin(640, 606, 13, 4)}${coin(660, 598, 12, -8)}${coin(648, 590, 11, 2)}</g>
        <g class="qd-hoard__piece" data-hoard="4">${gem(330, 600, 'g', 1.15)}</g>
        <g class="qd-hoard__piece" data-hoard="5">
            <g transform="translate(850 592) rotate(-6)">
                <path d="M-28 0 L-28 -22 Q 0 -42 28 -22 L28 0 Z" fill="#6b3a18" stroke="#3a1d0a" stroke-width="2"/>
                <rect x="-28" y="-2" width="56" height="24" rx="3" fill="#7d4520" stroke="#3a1d0a" stroke-width="2"/>
                <path d="M-28 -12 Q 0 -32 28 -12 M-30 8 H30" fill="none" stroke="#e8b94e" stroke-width="3"/>
                <rect x="-5" y="-4" width="10" height="12" rx="2" fill="#f4c34d" stroke="#8a5516" stroke-width="1.2"/>
                <path d="M-20 -22 Q -10 -34 0 -37" fill="none" stroke="#ffe7a0" stroke-opacity=".6" stroke-width="2"/>
            </g>
        </g>
        <g class="qd-hoard__piece" data-hoard="6">${gem(560, 600, 'r', 1.3)}${coin(586, 606, 11, 10)}</g>
        <g class="qd-hoard__piece" data-hoard="7">
            <g transform="translate(150 586) rotate(-12) scale(1.25)">
                <path d="M-16 -18 L-8 -6 L0 -20 L8 -6 L16 -18 L14 4 L-14 4 Z" fill="url(#${ID}-coin)" stroke="#8a5516" stroke-width="1.4"/>
                <circle cx="0" cy="-2" r="3.2" fill="url(#${ID}-gem-r)"/><circle cx="-9" cy="0" r="2.2" fill="url(#${ID}-gem-b)"/><circle cx="9" cy="0" r="2.2" fill="url(#${ID}-gem-g)"/>
            </g>
        </g>
        <g class="qd-hoard__piece" data-hoard="8">${gem(440, 604, 'b', 1.05)}${coin(412, 610, 12, -6)}${coin(468, 612, 11, 6)}</g>
        ${sparkle(250, 584, .8, 'qd-glint--a')}${sparkle(762, 586, .9, 'qd-glint--b')}${sparkle(562, 590, .7, 'qd-glint--c')}${sparkle(856, 566, .8, 'qd-glint--d')}
    </g>`;
}

function backSpikes() {
    // Spikes along the ridge, from the neck to the tail (each a small curved fin).
    const spots = [
        [440, 336, -40, .6], [470, 308, -32, .75], [506, 285, -22, .9], [548, 270, -12, 1], [594, 261, -3, 1.06],
        [642, 259, 6, 1.06], [688, 265, 16, 1], [730, 279, 28, .92], [768, 301, 40, .82], [800, 330, 52, .72], [822, 366, 64, .6]
    ];
    return spots.map(([x, y, r, s]) => `<path transform="translate(${x} ${y}) rotate(${r}) scale(${s})" d="M-11 4 C -9 -10 -4 -22 4 -30 C 3 -18 7 -6 11 4 Z" fill="url(#${ID}-spike)" stroke="#7a4d1d" stroke-opacity=".5" stroke-width="1"/>`).join('');
}

function tail() {
    return `
    <g class="qd-tail">
        <path d="M778 352 C 880 360 952 430 930 500 C 908 566 780 586 600 582 C 480 580 380 576 300 564
                 C 284 561 276 552 280 544 C 320 552 380 556 440 556 C 600 560 800 556 860 512 C 900 482 892 420 790 410 Z"
            fill="url(#${ID}-hide)"/>
        <path d="M778 352 C 880 360 952 430 930 500 C 908 566 780 586 600 582 C 480 580 380 576 300 564
                 C 284 561 276 552 280 544 C 320 552 380 556 440 556 C 600 560 800 556 860 512 C 900 482 892 420 790 410 Z"
            fill="url(#${ID}-scales)"/>
        <path d="M300 556 C 380 564 480 568 600 568 C 760 570 880 548 912 492" fill="none" stroke="#f0cf86" stroke-opacity=".55" stroke-width="5" stroke-dasharray="2 12" stroke-linecap="round"/>

    </g>`;
}

function tailTip() {
    return `        
            <path d="M286 552 C 266 548 240 536 218 520 C 230 542 222 558 202 570 C 230 570 252 566 270 562 Z" fill="url(#${ID}-spike)" stroke="#7a4d1d" stroke-opacity=".5" stroke-width="1.2"/>
            <path d="M280 554 C 258 550 236 542 218 528" fill="none" stroke="#fff1cc" stroke-opacity=".5" stroke-width="1.5"/>
        `;
}

function farWing() {
    return `
    <path class="qd-far-wing" d="M600 262 C 640 214 690 196 740 200 C 724 226 726 252 742 276 C 712 270 676 268 646 276 Z" fill="#2c2766" opacity=".95"/>
    <path d="M600 262 C 640 214 690 196 740 200" fill="none" stroke="#8f7ad8" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>`;
}

function body() {
    return `
    <g class="qd-body">
        <!-- torso -->
        <path d="M420 360 C 450 300 530 262 620 258 C 710 256 790 290 820 350 C 846 404 840 470 800 500
                 C 740 526 620 524 520 514 C 470 508 440 496 428 474 C 414 446 410 400 420 360 Z" fill="url(#${ID}-hide)"/>
        <path d="M420 360 C 450 300 530 262 620 258 C 710 256 790 290 820 350 C 846 404 840 470 800 500
                 C 740 526 620 524 520 514 C 470 508 440 496 428 474 C 414 446 410 400 420 360 Z" fill="url(#${ID}-scales)"/>
        <path d="M420 360 C 450 300 530 262 620 258 C 710 256 790 290 820 350 C 846 404 840 470 800 500
                 C 740 526 620 524 520 514 C 470 508 440 496 428 474 C 414 446 410 400 420 360 Z" fill="url(#${ID}-rim)"/>
        <!-- belly plates -->
        <path d="M440 478 C 520 506 640 512 760 498 C 740 512 640 524 540 516 C 490 512 456 500 440 478 Z" fill="url(#${ID}-belly)" opacity=".95"/>
        <path d="M480 494 L486 510 M530 502 L534 516 M580 506 L582 520 M630 508 L630 521 M680 506 L678 518 M726 500 L722 512" stroke="#9c6a2c" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>
        <!-- hind leg -->
        <path d="M690 360 C 760 344 820 380 826 440 C 830 480 810 500 790 508 L 700 508 C 680 500 672 486 680 474 C 700 470 724 470 740 466 C 730 440 700 420 676 408 C 664 390 670 368 690 360 Z" fill="url(#${ID}-hide-dark)"/>
        <path d="M690 360 C 760 344 820 380 826 440" fill="none" stroke="#8fe3e6" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>
        <g fill="#f6e7c4" stroke="#8a6a3a" stroke-width="1">
            <path d="M700 508 C 692 508 684 512 682 518 C 690 516 698 514 706 512 Z"/>
            <path d="M728 510 C 720 512 714 516 712 522 C 720 520 728 518 734 514 Z"/>
            <path d="M756 510 C 750 513 744 518 744 524 C 752 520 758 517 762 513 Z"/>
        </g>
    </g>`;
}

function nearWing() {
    // Folded along the back: the arm rises to the wrist claw, the fingers sweep back towards the
    // tail and the membrane hangs between them in pleats.
    const outline = 'M500 336 C 528 300 560 270 598 252 C 660 246 740 262 838 318 C 822 330 814 346 818 366 C 798 360 782 372 778 392 C 758 382 738 390 728 408 C 706 396 680 400 664 414 C 640 398 610 396 590 404 C 566 384 534 362 500 336 Z';
    return `
    <g>
        <path d="${outline}" fill="url(#${ID}-wing)"/>
        <path d="${outline}" fill="url(#${ID}-wing-glow)"/>
        <path d="M598 252 C 700 300 760 330 818 366 M598 252 C 680 310 730 350 778 392 M598 252 C 660 320 700 370 728 408 M598 252 C 630 330 650 380 664 414 M598 252 C 600 330 596 370 590 404"
            fill="none" stroke="#a48df0" stroke-opacity=".45" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M500 336 C 528 300 560 270 598 252 C 660 246 740 262 838 318" fill="none" stroke="#b9a6f2" stroke-opacity=".7" stroke-width="4.5" stroke-linecap="round"/>
        <circle cx="598" cy="252" r="7" fill="#c7b3ff"/>
        <path d="M594 246 C 594 230 600 218 612 210 C 608 222 608 234 610 246 Z" fill="url(#${ID}-horn)"/>
    </g>`;
}

function neckAndPaws() {
    return `
    <g class="qd-neck">
        <path d="M476 322 C 420 318 372 340 348 380 C 334 404 330 428 336 452 L 410 478 C 420 450 440 430 470 420 C 468 384 472 350 476 322 Z" fill="url(#${ID}-hide)"/>
        <path d="M476 322 C 420 318 372 340 348 380 C 334 404 330 428 336 452 L 410 478 C 420 450 440 430 470 420 C 468 384 472 350 476 322 Z" fill="url(#${ID}-scales)"/>
        <path d="M476 322 C 420 318 372 340 348 380" fill="none" stroke="#8fe3e6" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/>
    </g>
    <g class="qd-paws">
        <path d="M404 454 C 430 446 470 452 486 476 C 492 492 480 508 460 512 L 330 512 C 310 510 302 496 314 488 C 340 482 370 478 404 472 Z" fill="url(#${ID}-hide-dark)"/>
        <path d="M380 470 C 400 462 430 462 452 474" fill="none" stroke="#8fe3e6" stroke-opacity=".3" stroke-width="2.5" stroke-linecap="round"/>
        <g fill="#f6e7c4" stroke="#8a6a3a" stroke-width="1">
            <path d="M318 492 C 306 494 298 500 296 508 C 306 506 314 503 322 500 Z"/>
            <path d="M334 500 C 322 503 314 509 313 516 C 322 513 331 510 338 506 Z"/>
            <path d="M352 504 C 342 507 336 513 336 520 C 344 517 352 513 358 509 Z"/>
        </g>
    </g>`;
}

function head() {
    return `
    <g><g transform="translate(350 446) scale(1.18) translate(-350 -446)">
        <!-- back horn (further away, darker) -->
        <path d="M334 376 C 352 354 378 338 410 330 C 386 344 370 360 356 384 Z" fill="#8a6230"/>
        <!-- skull and snout -->
        <path d="M352 392 C 336 368 300 360 262 368 C 236 374 212 386 190 404 C 172 418 154 428 140 440
                 C 130 450 134 466 150 470 C 196 480 262 482 306 476 C 336 472 356 458 362 438 C 366 420 362 404 352 392 Z" fill="url(#${ID}-hide)"/>
        <path d="M352 392 C 336 368 300 360 262 368 C 236 374 212 386 190 404 C 172 418 154 428 140 440
                 C 130 450 134 466 150 470 C 196 480 262 482 306 476 C 336 472 356 458 362 438 C 366 420 362 404 352 392 Z" fill="url(#${ID}-scales)"/>
        <path d="M352 392 C 336 368 300 360 262 368 C 236 374 212 386 190 404 C 172 418 154 428 140 440" fill="none" stroke="#a9f0ee" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>
        <!-- jaw and chin -->
        <path d="M150 470 C 196 480 262 482 306 476 C 300 486 270 494 230 494 C 190 494 160 486 150 470 Z" fill="url(#${ID}-belly)" opacity=".85"/>
        <path d="M160 462 C 196 466 236 466 268 460 C 276 458 282 454 286 450" fill="none" stroke="#0a2133" stroke-opacity=".7" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M286 450 C 290 454 290 458 286 462" fill="none" stroke="#0a2133" stroke-opacity=".6" stroke-width="2" stroke-linecap="round"/>
        <!-- whisker barbels from the snout -->
        <path class="qd-whisker" d="M170 468 C 150 486 128 494 102 494 C 118 502 140 502 160 494" fill="none" stroke="#f0cf86" stroke-opacity=".8" stroke-width="2" stroke-linecap="round"/>
        <!-- nostril -->
        <path d="M156 440 C 162 436 170 436 174 440" fill="none" stroke="#06182a" stroke-width="3" stroke-linecap="round"/>
        <!-- brow ridge -->
        <path d="M228 392 C 246 380 276 376 300 384 C 284 384 262 390 246 400 Z" fill="#0d2b40" opacity=".75"/>
        <path d="M226 392 C 246 378 278 374 302 384" fill="none" stroke="#a9f0ee" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>
        <!-- cheek fin / ear frill -->
        <g class="qd-frill"><path d="M316 404 C 334 396 356 396 378 402 C 364 408 370 414 382 420 C 366 420 368 428 376 436 C 356 430 336 426 320 426 Z" fill="#163f55" stroke="#f0cf86" stroke-opacity=".7" stroke-width="1.4"/>
            <path d="M320 410 L370 404 M322 418 L372 422 M324 424 L366 434" stroke="#f0cf86" stroke-opacity=".45" stroke-width="1.2" stroke-linecap="round"/></g>
        <!-- front horn -->
        <path d="M318 382 C 336 352 366 330 404 318 C 420 312 436 312 446 318 C 420 320 396 330 376 346 C 360 360 346 376 336 392 Z" fill="url(#${ID}-horn)" stroke="#7a4d1d" stroke-opacity=".45" stroke-width="1"/>
        <path d="M326 378 C 346 352 376 330 420 318" fill="none" stroke="#fff6dc" stroke-opacity=".6" stroke-width="2" stroke-linecap="round"/>
        <path d="M342 362 L338 369 M362 344 L358 352 M384 332 L381 340" stroke="#7a4d1d" stroke-opacity=".45" stroke-width="1.6" stroke-linecap="round"/>
        <!-- little nose horn -->
        <path d="M188 404 C 190 392 196 384 206 380 C 202 390 202 398 204 406 Z" fill="url(#${ID}-horn)"/>

        <!-- eye: the sleeping lid (a gentle curve) and the waking eye that opens beneath it -->
        <g class="qd-eye">
            <g class="qd-eye__open">
                <path d="M238 410 C 248 398 270 396 284 404 C 274 416 252 420 238 410 Z" fill="#1b0d05"/>
                <path d="M241 409 C 250 400 268 399 280 405 C 271 414 253 417 241 409 Z" fill="url(#${ID}-iris)"/>
                <path class="qd-eye__pupil" d="M261 400 C 258 404 258 412 261 416 C 264 412 264 404 261 400 Z" fill="#1b0d05"/>
                <circle cx="268" cy="404" r="2" fill="#fffbe6"/>
            </g>
            <path class="qd-eye__lid" d="M236 410 C 248 420 270 418 284 404" fill="none" stroke="#06182a" stroke-width="3.2" stroke-linecap="round"/>
            <path class="qd-eye__lash" d="M246 416 L242 422 M258 418 L257 425 M270 415 L273 421" stroke="#06182a" stroke-opacity=".6" stroke-width="1.8" stroke-linecap="round"/>
        </g>
    </g></g>`;
}

const layer = (body, cls = '') => `<svg class="qd-layer ${cls}" viewBox="0 0 1000 620" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">${body}</svg>`;

/**
 * The whole dragon on its hoard. Each moving part is its own HTML layer holding a full-size SVG, so
 * breathing, the head and the wing move as composited layers (cheap on weak laptops) instead of
 * repainting the drawing every frame.
 */
export function quietDragonHtml({ label = 'The Quiet Dragon, asleep on its hoard' } = {}) {
    return `
    <div class="qd-dragon" role="img" aria-label="${label}">
        ${layer(`${defs()}<ellipse cx="520" cy="560" rx="420" ry="38" fill="#04060f" opacity=".45"/>${hoard()}`, 'qd-layer--hoard')}
        <div class="qd-part qd-breath">
            ${layer(`${tail()}${farWing()}${body()}${backSpikes()}`)}
            <div class="qd-part qd-tailtip">${layer(tailTip())}</div>
            <div class="qd-part qd-wing">${layer(nearWing())}</div>
            ${layer(neckAndPaws())}
            <div class="qd-part qd-head">${layer(head())}</div>
        </div>
        ${layer(hoardFront(), 'qd-layer--front')}
        <div class="qd-smoke" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="qd-zzz" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></div>
    </div>`;
}
