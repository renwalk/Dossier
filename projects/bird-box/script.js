// =============================================================
// BIRD VISUALS — color and amplify settings keyed by Common Name.
// When a bird has a sound + size entry in the CSV life list,
// these visuals are applied. Add an entry here for any new bird
// you add to the CSV.
// =============================================================
const BIRD_VISUALS = {
    "northern flicker": {
        amplify: 50,
        wing: "#B8A874", wing2: "#020202",
        belly: "#CCBF98", belly2: "#020202",
        head: "#BCAEAD", head2: "#F44336", beak: "#666655"
    },
    "northern cardinal": {
        amplify: 50,
        wing: "#8A4436", wing2: "#C62710",
        belly: "#E74B31", belly2: "#C62710",
        head: "#2D0C0A", head2: "#4A1510", beak: "#F6321C"
    },
    "blue jay": {
        amplify: 40,
        wing: "#1E5FA8", wing2: "#4A90D9",
        belly: "#FFFFFF", belly2: "#B8D4F0",
        head: "#1A3A6B", head2: "#2563A8", beak: "#333333"
    },
    "red-winged blackbird": {
        amplify: 5,
        wing: "#000000", wing2: "#F44336",
        belly: "#FFD700", belly2: "#272723",
        head: "#272723", head2: "#111111", beak: "#7A7A71"
    },
    "american robin": {
        amplify: 60,
        wing: "#888a8b", wing2: "#4A4444",
        belly: "#CD6912", belly2: "#E8781A",
        head: "#353131", head2: "#1A1A1A", beak: "#FFD700"
    },
    "song sparrow": {
        amplify: 50,
        wing: "#8B6914", wing2: "#C4A46B",
        belly: "#F5F0DC", belly2: "#D2B48C",
        head: "#8B4513", head2: "#DEB887", beak: "#8B7355"
    },
    "baltimore oriole": {
        amplify: 50,
        wing: "#151514", wing2: "#d77205",
        belly: "#d5cebf", belly2: "#bf8f51",
        head: "#0f0702", head2: "#161514", beak: "#171717"
    },
    "american redstart": {
        amplify: 50,
        wing: "#151514", wing2: "#b8b8b8",
        belly: "#ffb300", belly2: "#f1be7c",
        head: "#0f0702", head2: "#DEB887", beak: "#6b6c71"
    },
    "gray catbird": {
        amplify: 50,
        wing: "#999998", wing2: "#905206",
        belly: "#c9c8c5", belly2: "#9f6a08ff",
        head: "#acacac", head2: "#404040", beak: "#212121"
    },
    "indigo bunting": {
        amplify: 50,
        wing: "#676767ff", wing2: "#0a4a8bff",
        belly: "#127dcaff", belly2: "#545457ff",
        head: "#0c46b9c2", head2: "#0aa8d4ff", beak: "#f8f7f7ff"
    },
    "tree swallow": {
        amplify: 50,
        wing: "#5b5252ff", wing2: "#0080ffff",
        belly: "#ffffffff", belly2: "#e2e2e4ff",
        head: "#188ef4c2", head2: "#011014ff", beak: "#d5d4d4ff"
    },
    "carolina wren": {
        amplify: 50,
        wing: "#9d580dff", wing2: "#270a01ff",
        belly: "#e4b55eff", belly2: "#e4e3e2ff",
        head: "#925c00c2", head2: "#e8e8e8ff", beak: "#333232ff"
    }
};

// Default visuals for birds not yet in BIRD_VISUALS
const DEFAULT_VISUAL = {
    amplify: 10,
    wing: "#775252ff", wing2: "#aaaaaa",
    belly: "#cccccc", belly2: "#e7e3e3ff",
    head: "#555555", head2: "#333333", beak: "#222222"
};

// =============================================================
// LAYOUT CONSTANTS — adjust these to change circle size/spacing
// =============================================================
const CIRCLE_RADIUS = 60; // base radius for a "sm" (1-col) bird
const GAP = 0;            // gap between circles in px
const PAD = 50;           // padding around the grid in px

// =============================================================
// INTERNALS — no need to edit below when adding birds
// =============================================================
let birds = [];
let lifeListTable;

const SIZE_SPAN = { sm: 1, md: 2, lg: 3 };

function preload() {
    lifeListTable = loadTable("data/ebird_world_life_list.csv", "csv", "header");
}

function setup() {
    // Build birds from CSV rows that have both sound and size filled in
    birds = [];
    for (let i = 0; i < lifeListTable.getRowCount(); i++) {
        let row = lifeListTable.getRow(i);
        let soundFile = row.get("sound").trim();
        let size = row.get("size").trim();
        if (!soundFile || !size) continue;

        let name = row.get("Common Name").trim();
        let visual = BIRD_VISUALS[name] || DEFAULT_VISUAL;

        birds.push(Object.assign({ name, soundFile: "sounds/" + soundFile, size }, visual));
    }

    // Load sounds and set up amplitude analyzers
    for (let bird of birds) {
        bird.sound = loadSound(bird.soundFile);
        bird.amplitude = new p5.Amplitude();
        bird.amplitude.setInput(bird.sound);
        bird.isPlaying = false;
    }

    let canvas = createCanvas(canvasWidth(), canvasHeight());
    canvas.parent("p5-container");

    buildNavLinks();
}

function buildNavLinks() {
    let nav = document.getElementById("bird-list");
    nav.innerHTML = "";
    birds.forEach((bird, i) => {
        let a = document.createElement("a");
        a.href = "#";
        a.textContent = bird.name;
        a.addEventListener("click", e => {
            e.preventDefault();
            toggleBird(i);
        });
        bird.navLink = a;
        nav.appendChild(a);
    });
}

function toggleBird(i) {
    let bird = birds[i];
    if (!bird.sound.isLoaded()) return; // not ready yet
    if (bird.sound.isPlaying()) {
        bird.sound.pause();
        bird.isPlaying = false;
        bird.navLink.classList.remove("active");
    } else {
        userStartAudio();
        bird.sound.loop();
        bird.isPlaying = true;
        bird.navLink.classList.add("active");
    }
}

function canvasContainerWidth() {
    return document.getElementById("p5-wrapper").offsetWidth;
}

function canvasWidth() {
    return canvasContainerWidth();
}

function getColCount() {
    let w = canvasContainerWidth();
    for (let cols = 8; cols > 1; cols--) {
        let needed = PAD * 2 + cols * (CIRCLE_RADIUS * 2) + (cols - 1) * GAP;
        if (w >= needed) return cols;
    }
    return 1;
}

// Masonry layout: each bird is placed into whichever column(s) are shortest,
// so circles pack upward and fill gaps naturally rather than leaving empty space.
function getBirdLayout() {
    let cols = getColCount();
    let cellSize = CIRCLE_RADIUS * 2 + GAP;
    let colHeights = new Array(cols).fill(PAD);
    let positions = [];

    for (let bird of birds) {
        let span = Math.min(SIZE_SPAN[bird.size] || 1, cols);

        let bestCol = 0, bestTop = Infinity;
        for (let c = 0; c <= cols - span; c++) {
            let top = Math.max(...colHeights.slice(c, c + span));
            if (top < bestTop) { bestTop = top; bestCol = c; }
        }

        let r = (span * cellSize - GAP) / 2;
        positions.push({ x: PAD + bestCol * cellSize + r, y: bestTop + r, baseSize: r });

        for (let c = bestCol; c < bestCol + span; c++) {
            colHeights[c] = bestTop + r * 2 + GAP;
        }
    }

    return positions;
}

function canvasHeight() {
    if (birds.length === 0) return 400;
    let layout = getBirdLayout();
    return Math.max(...layout.map(p => p.y + p.baseSize)) + PAD;
}

function draw() {
    background("rgb(219,215,206)");

    let layout = getBirdLayout();
    for (let i = 0; i < birds.length; i++) {
        let { x, y, baseSize } = layout[i];
        birds[i].x = x;
        birds[i].y = y;
        birds[i].baseSize = baseSize;
        drawBird(x, y, birds[i]);
    }
}

function mouseClicked() {
    for (let i = 0; i < birds.length; i++) {
        let bird = birds[i];
        if (bird.x === undefined) continue;
        if (dist(mouseX, mouseY, bird.x, bird.y) < bird.baseSize) {
            toggleBird(i);
            break;
        }
    }
}

function drawBird(x, y, bird) {
    let r = bird.baseSize || CIRCLE_RADIUS;
    let level = min(bird.amplitude.getLevel() * (bird.amplify || 1), 1);
    let size = bird.sound.isPlaying()
        ? map(level, 0, 0.5, r * 1.25, r)
        : r;

    noStroke();
    fill(bird.wing); ellipse(x, y, size * 2, size * 2);
    fill(bird.wing2); ellipse(x, y, size * 1.65, size * 1.65);
    fill(bird.belly); ellipse(x, y, size * 1.325, size * 1.325);
    fill(bird.belly2); ellipse(x, y, size * 0.7, size * 0.7);
    fill(bird.head); ellipse(x, y, size * 0.5, size * 0.5);
    fill(bird.head2); ellipse(x, y, size * 0.175, size * 0.175);
    fill(bird.beak); ellipse(x, y, size * 0.125, size * 0.125);
}

function windowResized() {
    resizeCanvas(canvasWidth(), canvasHeight());
}
