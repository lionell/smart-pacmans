let app = new PIXI.Application(window.innerWidth, window.innerHeight, {backgroundColor : 0x1099bb});
document.body.appendChild(app.view);

const pacmanTexture = PIXI.Texture.fromImage('assets/pacman.png');
const ghostTexture = PIXI.Texture.fromImage('assets/ghost.png');
const ripTexture = PIXI.Texture.fromImage('assets/rip.png');

const small = {
    fontFamily: 'Courier',
    fontSize: 14,
    fill: 'white',
    align: 'left'
};

const large = {
    fontFamily: 'Courier',
    fontSize: 35,
    fill: 'white',
    align: 'left'
};

let background = PIXI.Sprite.fromImage('assets/background.jpg');
background.width = app.screen.width;
background.height = app.screen.height;
app.stage.addChild(background);

window.addEventListener('resize', onResize);
function onResize() {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    background.width = app.screen.width;
    background.height = app.screen.height;
}

let autoRespawnMode = false;
let dynamicGhostsMode = false;
let autoMutationMode = false;
let autoSelectionMode = false;
let autoEvolutionMode = false;
let showInfoMode = false;
let paused = false;
let epoch = 1;

window.setInterval(function() { if (autoMutationMode) mutation(); }, 30000);
window.setInterval(function() { if (autoSelectionMode) selection(); }, 7000);
window.setInterval(function() { if (autoEvolutionMode) evolution(); }, 60000);

document.addEventListener('keydown', onKeyDown);
function onKeyDown(event) {
    if (event.keyCode == /* r= */ 82) {
        autoRespawnMode = !autoRespawnMode;
        showNotification('Auto respawn mode ' + (autoRespawnMode ? 'on' : 'off'));
    } else if (event.keyCode == /* g= */ 71) {
        dynamicGhostsMode = !dynamicGhostsMode;
        showNotification(dynamicGhostsMode ? 'Dynamic ghosts' : 'Static ghosts');
    } else if (event.keyCode == /* m */ 77) {
        if (event.shiftKey) {
            autoMutationMode = !autoMutationMode;
            showNotification('Auto mutation mode ' + (autoMutationMode ? 'on' : 'off'));
        } else {
            mutation();
        }
    } else if (event.keyCode == /* s */ 83) {
        if (event.shiftKey) {
            autoSelectionMode = !autoSelectionMode;
            showNotification('Auto selection mode ' + (autoSelectionMode ? 'on' : 'off'));
        } else {
            selection();
        }
    } else if (event.keyCode == /* e */ 69) {
        if (event.shiftKey) {
            autoEvolutionMode = !autoEvolutionMode;
            showNotification('Auto evolution mode ' + (autoEvolutionMode ? 'on' : 'off'));
        } else {
            evolution();
        }
    } else if (event.keyCode == /* p */ 80) {
        paused = !paused;
        if (paused) {
            app.stop();
        } else {
            app.start();
        }
    } else if (event.keyCode == /* i */ 73) {
        showInfoMode = !showInfoMode;
        // for (let i = 0; i < pacmans.length; i++) {
        //     pacmans[i].info.visible = !pacmans[i].info.visible;
        // }
    } else if (event.keyCode == /* h */ 72) {
        showHelp();
    }
}

let pacmans = [];
let ghosts = [];

function createPacman() {
    let sprite = new PIXI.Sprite(pacmanTexture);
    let text = new PIXI.Text('', small);
    text.visible = false;
    sprite.anchor.set(0.5);
    let {x, y} = randomPoint();
    sprite.position.set(x, y);
    let rotation = randomRotation();
    sprite.rotation = rotation;

    app.stage.addChild(sprite);
    app.stage.addChild(text);
    return {
        sprite,
        rotation,
        speed: 2 * Math.random(),
        eaten: 0,
        lifetime: 0,
        brain: randomBrain(4, 2),
        info: text,
        think: function (pacman, ghost) {
            let a1 = pacman == null ? 0 : angle(this.sprite, pacman.sprite.position);
            let d1 = pacman == null ? 0 : distance(this.sprite.position, pacman.sprite.position) / 1000;
            let a2 = ghost == null ? 0 : angle(this.sprite, ghost.sprite.position);
            let d2 = ghost == null ? 0 : distance(this.sprite.position, ghost.sprite.position) / 1000;
            let delta = propagate(nj.array([a1, d1, a2, d2]), this.brain);
            let deltaRotation = delta.get(0);
            let deltaSpeed = delta.get(1);
            this.rotation = lerp(this.rotation, this.rotation + deltaRotation);
            this.speed = Math.max(0, Math.min(5, lerp(this.speed, this.speed + deltaSpeed)));
        },
        kill: function() {
            app.stage.removeChild(this.sprite);
            app.stage.removeChild(this.info);
            showRip(this.sprite.position);
        },
        energy: function() { return (1 + this.eaten) / this.lifetime * 1000; }
    };
}

function createGhostAt({x, y}) {
    let sprite = new PIXI.Sprite(ghostTexture);
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);
    let rotation = randomRotation();
    sprite.rotation = rotation;

    app.stage.addChild(sprite);
    return {
        sprite,
        rotation,
        kill: function() { app.stage.removeChild(sprite); }
    };
}

function createGhost() {
    return createGhostAt(randomPoint());
}

function gameSetup() {
    for (let i = 0; i < 10; i++) {
        pacmans.push(createPacman());
    }
    for (let i = 0; i < 30; i++) {
        ghosts.push(createGhost());
    }
}
gameSetup();

app.renderer.plugins.interaction.on('mousedown', createGhostAtPoint);
function createGhostAtPoint() {
    ghosts.push(createGhostAt(app.renderer.plugins.interaction.mouse.global));
}

// Listen for animate update
app.ticker.add(function(delta) {
    let ghostsKilled = new Set();
    for (let i = 0; i < pacmans.length; i++) {
        let pacman = pacmans[i];
        pacman.info.text = Math.round(pacman.energy() * 1000) / 1000;
        pacman.info.x = pacman.sprite.position.x - 20;
        pacman.info.y = pacman.sprite.position.y - 35;
        pacman.info.visible = showInfoMode;

        let closestGhost = null;
        for (let j = 0; j < ghosts.length; j++) {
            let ghost = ghosts[j];
            if (!canSee(pacman.sprite, ghost.sprite.position)) {
                continue;
            }
            if (closestGhost == null || distance(pacman.sprite.position, ghost.sprite.position) < distance(pacman.sprite.position, closestGhost.sprite.position)) {
                closestGhost = ghost;
            }
            // Mark killed ghosts to remove them later
            if (collide(pacman.sprite, ghost.sprite)) {
                ghostsKilled.add(ghost);
                pacman.eaten++;
            }
        }
        let closestPacman = null;
        for (let j = 0; j < pacmans.length; j++) {
            let p = pacmans[j];
            if (!canSee(pacman.sprite, p.sprite.position)) {
                continue;
            }
            if (closestPacman == null || distance(pacman.sprite.position, p.sprite.position) < distance(pacman.sprite.position, closestPacman.sprite.position)) {
                closestPacman = p;
            }
        }
        pacman.think(closestPacman, closestGhost);
    }
    // Remove killed ghosts
    ghostsKilled = [...ghostsKilled];
    for (let i = 0; i < ghostsKilled.length; i++) {
        let ghost = ghostsKilled[i];
        ghost.kill();
        ghosts.splice(ghosts.indexOf(ghost), 1);
        if (autoRespawnMode) {
            ghosts.push(createGhost());
        }
    }

    for (let i = 0; i < pacmans.length; i++) {
        let pacman = pacmans[i];
        pacman.sprite.rotation = pacman.rotation;
        // Move pacmans
        pacman.sprite.position.x += Math.cos(pacman.rotation) * pacman.speed * delta;
        pacman.sprite.position.y += Math.sin(pacman.rotation) * pacman.speed * delta;
        pacman.sprite.position = sanitizePosition(pacman.sprite.position);
        pacman.lifetime += Math.floor(delta);
    }
    for (let i = 0; i < ghosts.length; i++) {
        let ghost = ghosts[i];
        if (dynamicGhostsMode) {
            // Move ghosts
            ghost.sprite.position.x += Math.cos(ghost.rotation) * delta;
            ghost.sprite.position.y += Math.sin(ghost.rotation) * delta;
            ghost.sprite.position = sanitizePosition(ghost.sprite.position);
        }
    }
});

function collide(sprite1, sprite2) {
    return distance(sprite1.position, sprite2.position) < 32;
}

function distance(pos1, pos2) {
    let sqr = function(x) { return x * x; };
    return Math.sqrt(sqr(pos1.x - pos2.x) + sqr(pos1.y - pos2.y));
}

function length(pos) {
    return distance({x: 0, y: 0}, pos);
}

function diff(pos1, pos2) {
    return {
        x: pos2.x - pos1.x,
        y: pos2.y - pos1.y
    };
}

function cosine(obj, pos) {
    let d = diff(obj.position, pos);
    return (Math.cos(obj.rotation)*d.x + Math.sin(obj.rotation)*d.y) / length(d);
}

function sine(obj, pos) {
    let d = diff(obj.position, pos);
    return (Math.cos(obj.rotation)*d.y - Math.sin(obj.rotation)*d.x) / length(d);
}

function sanitizePosition({x, y}) {
    return {
        x: (x % app.screen.width + app.screen.width) % app.screen.width,
        y: (y % app.screen.height + app.screen.height) % app.screen.height
    };
}

function randomPoint() {
    return {
        x: Math.random() * app.screen.width,
        y: Math.random() * app.screen.height
    };
}

function randomRotation() {
    return 2 * Math.PI * Math.random();
}

function random(val) {
    return Math.floor(Math.random() * val);
}

let oldText = null;

function showNotification(msg) {
    app.stage.removeChild(oldText);
    var text = new PIXI.Text(msg, large);
    text.x = 50;
    text.y = 50;
    app.stage.addChild(text);
    window.setTimeout(function() { app.stage.removeChild(text); }, 2500);
    oldText = text;
}

function showRip({x, y}) {
    var sprite = new PIXI.Sprite(ripTexture);
    sprite.position.set(x, y);
    app.stage.addChild(sprite);
    window.setTimeout(function() { app.stage.removeChild(sprite); }, 2500);
}

let epochText = new PIXI.Text('Epoch 1', large);
epochText.x = 50;
epochText.y = app.screen.height - 80;
app.stage.addChild(epochText);

let helpText = new PIXI.Text(
    '        HELP        \n' +
    '\n' +
    'r    - ghosts respawn\n' +
    'g    - dynamic ghosts\n' +
    'm(M) - (auto)mutation\n' +
    's(S) - (auto)selection\n' +
    'e(E) - (auto)evolution\n' +
    'p    - pause/resume\n' +
    'i    - show/hide info\n' +
    'h    - this help', large);
helpText.x = app.screen.width / 2 - 200;
helpText.y = app.screen.height / 2 - 150;
helpText.visible = false;
app.stage.addChild(helpText);

function showHelp() {
    helpText.visible = true;
    window.setTimeout(function() { helpText.visible = false; }, 5000);
}

function propagate(input, nn) {
    for (let i = 0; i < nn.length; i++) {
        input = nj.tanh(nj.dot(nj.concatenate([1, input]), nn[i]));
    }
    return input;
}

function randomLayer(shape) {
    return nj.random(shape).subtract(0.5);
}

function randomBrain(input, output) {
    return [randomLayer([input + 1, 10]),
            randomLayer([11, 20]),
            randomLayer([21, 10]),
            randomLayer([11, output])];
}

function lerp(val1, val2) {
    return val1 + (val2 - val1) * 0.7;
}

function canSee(obj, pos) {
    return cosine(obj, pos) >= 0;
}

function angle(obj, pos) {
    let c = cosine(obj, pos);
    let s = sine(obj, pos);
    return s < 0 ? -Math.acos(c) : Math.acos(c);
}

function mutateBrain(brain) {
    for (let i = 0; i < brain.length; i++) {
        if (Math.random() < 0.1) {
            brain[i] = randomLayer(brain[i].shape);
        }
    }
}

function mutation() {
    showNotification('Mutation');
    mutateBrain(pacmans[random(pacmans.length)].brain);
}

function selection() {
    showNotification('Selection & Crossing');
    pacmans.sort(byEnergy);
    let pacman = cross(pacmans[0], pacmans[1]);

    let worst = pacmans[pacmans.length - 1];
    worst.kill();
    pacmans.splice(pacmans.indexOf(worst), 1);
    pacmans.push(pacman);
}

// Descending
function byEnergy(p1, p2) {
    return p1.energy() > p2.energy() ? -1 : 1;
}

function crossBrains(b1, b2) {
    b3 = [];
    for (let i = 0; i < b1.length; i++) {
        if (Math.random() < 0.5) {
            b3.push(b1[i].clone());
        } else {
            b3.push(b2[i].clone());
        }
    }
    return b3;
}

function cross(pacman1, pacman2) {
    let brain = crossBrains(pacman1.brain, pacman2.brain);
    let pacman = createPacman();
    pacman.brain = brain;
    return pacman;
}

function evolution() {
    showNotification('Evolution');
    pacmans.sort(byEnergy);
    let best = pacmans.slice(0, pacmans.length / 2);
    let worst = pacmans.slice(pacmans.length / 2);

    for (let i = 0; i < worst.length; i++) {
        let j = random(best.length);
        let k = random(best.length);
        let pacman = cross(best[j], best[k]);
        pacmans.push(pacman);
    }

    for (let i = 0; i < worst.length; i++) {
        worst[i].kill();
        pacmans.splice(pacmans.indexOf(worst[i]), 1);
    }
    epoch++;
    epochText.text = 'Epoch ' + epoch;
}
