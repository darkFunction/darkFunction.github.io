function initialise2DArray(w, h, value) {
    var array = [w];
    for (var col = 0; col < w; ++col) {
        array[col] = [h];
        for (var row = 0; row < h; ++row) {
            array[col][row] = value;
        }
    }
    return array;
}
function sq(n) {
    return n * n;
}
/// <reference path="Utils.ts" />
var Vec = (function () {
    function Vec(x, y) {
        this.x = x;
        this.y = y;
    }
    Vec.prototype.insideCircle = function (cx, cy, radius) {
        return sq(this.x - cx) + sq(this.y - cy) < sq(radius);
    };
    Vec.prototype.displaced = function (angle, distance) {
        return new Vec(this.x + (distance * Math.cos(angle)), this.y + (distance * Math.sin(angle)));
    };
    return Vec;
})();
/// <reference path="Vec.ts" />
/// <reference path="Actor.ts" />
var Colour = (function () {
    function Colour(r, g, b, a) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }
    return Colour;
})();
var Renderer = (function () {
    function Renderer(canvas) {
        this.context = canvas.getContext("2d");
        this.width = canvas.width;
        this.height = canvas.height;
        var backCanvas = document.createElement('canvas');
        backCanvas.width = this.width;
        backCanvas.height = this.height;
        this.backContext = backCanvas.getContext('2d');
        this.imageData = this.context.createImageData(canvas.width, canvas.height);
    }
    Renderer.prototype.render = function (ants, food, nest, nestPheromone, foodPheromone) {
        this.context.clearRect(0, 0, this.width, this.height);
        this.drawGround();
        this.drawPheromones(nestPheromone, new Colour(0, 255, 0, 255));
        this.drawPheromones(foodPheromone, new Colour(255, 255, 0, 255));
        this.drawNest(nest);
        this.drawActors(ants, '#000000');
        this.drawActors(food, '#FF0000');
    };
    Renderer.prototype.drawNest = function (nest) {
        this.context.fillStyle = '#8F6911';
        this.drawActor(nest);
    };
    Renderer.prototype.drawGround = function () {
        this.context.fillStyle = '#00BB00';
        this.context.fillRect(0, 0, this.width, this.height);
    };
    Renderer.prototype.drawPheromones = function (pheromones, colour) {
        this.context.fillStyle = '#00FF00';
        var pos = new Vec(0, 0);
        for (pos.x = 0; pos.x < pheromones.length; ++pos.x) {
            for (pos.y = 0; pos.y < pheromones[pos.x].length; ++pos.y) {
                colour.a = 255 * pheromones[pos.x][pos.y];
                this.setPixel(this.imageData, pos, colour);
            }
        }
        this.backContext.putImageData(this.imageData, 0, 0);
        this.context.drawImage(this.backContext.canvas, 0, 0);
    };
    Renderer.prototype.drawActors = function (actors, colour) {
        this.context.fillStyle = colour;
        for (var i = 0; i < actors.length; ++i) {
            this.drawActor(actors[i]);
        }
    };
    Renderer.prototype.drawActor = function (actor) {
        var radius = actor.size / 2;
        this.context.beginPath();
        this.context.arc(actor.pos.x, actor.pos.y, radius, 0, 2 * Math.PI);
        this.context.fill();
    };
    Renderer.prototype.setPixel = function (imageData, pos, colour) {
        var i = (pos.x + pos.y * imageData.width) * 4;
        imageData.data[i] = colour.r;
        imageData.data[i + 1] = colour.g;
        imageData.data[i + 2] = colour.b;
        imageData.data[i + 3] = colour.a;
    };
    return Renderer;
})();
/// <reference path="Actor.ts" />
/// <reference path="World.ts" />
var AntBehaviour;
(function (AntBehaviour) {
    AntBehaviour[AntBehaviour["Foraging"] = 0] = "Foraging";
    AntBehaviour[AntBehaviour["Returning"] = 1] = "Returning";
})(AntBehaviour || (AntBehaviour = {}));
;
var PheromoneType;
(function (PheromoneType) {
    PheromoneType[PheromoneType["Nest"] = 0] = "Nest";
    PheromoneType[PheromoneType["Food"] = 1] = "Food";
})(PheromoneType || (PheromoneType = {}));
;
var Ant = (function () {
    function Ant(pos, world) {
        this.pos = pos;
        this.world = world;
        this.size = 2;
        this.angle = Math.random() * Math.PI * 2;
        this.behaviour = AntBehaviour.Foraging;
        this.pheromoneStrength = 1.0;
    }
    Ant.prototype.update = function () {
        (this.behaviour == AntBehaviour.Foraging) ? this.checkFood() : this.checkNest();
        var scent = this.sniff();
        if (Math.abs(scent) > 0.01) {
            this.angle += (scent > 0) ? Ant.TURN_SPEED : -Ant.TURN_SPEED;
        }
        else {
            this.angle += ((Math.random() - 0.5) * 2) * Ant.WIGGLE;
        }
        this.move();
        this.dropPheromone();
    };
    Ant.prototype.checkNest = function () {
        var nest = this.world.nest;
        if (this.pos.insideCircle(nest.pos.x, nest.pos.y, nest.size / 2)) {
            this.pheromoneStrength = 1.0;
            this.behaviour = AntBehaviour.Foraging;
        }
    };
    Ant.prototype.checkFood = function () {
        var food = this.world.foodAtPos(this.pos);
        if (food) {
            // Found food!
            food.size -= 0.5;
            this.behaviour = AntBehaviour.Returning;
            this.pheromoneStrength = 1.0;
            // Turn 180
            this.angle += Math.PI;
        }
    };
    Ant.prototype.move = function () {
        var deltaX = Math.cos(this.angle) * Ant.SPEED;
        var deltaY = Math.sin(this.angle) * Ant.SPEED;
        if (this.pos.x + deltaX < 0 || this.pos.x + deltaX > this.world.width) {
            deltaX = 0;
        }
        if (this.pos.y + deltaY < 0 || this.pos.y + deltaY > this.world.height) {
            deltaY = 0;
        }
        this.pos.x += deltaX;
        this.pos.y += deltaY;
    };
    Ant.prototype.sniff = function () {
        var leftAntennaPos = this.pos.displaced(this.angle + Math.PI / 4, 3);
        var rightAntennaPos = this.pos.displaced(this.angle - Math.PI / 4, 3);
        var pheromoneType = this.behaviour == AntBehaviour.Foraging ? PheromoneType.Food : PheromoneType.Nest;
        var leftScent = this.world.getPheromoneAt(leftAntennaPos, pheromoneType);
        var rightScent = this.world.getPheromoneAt(rightAntennaPos, pheromoneType);
        return leftScent - rightScent;
    };
    Ant.prototype.dropPheromone = function () {
        if (this.pheromoneStrength > 0) {
            var pheromoneType = this.behaviour == AntBehaviour.Foraging ? PheromoneType.Nest : PheromoneType.Food;
            this.world.dropPheromone(pheromoneType, this.pos, this.pheromoneStrength, Ant.PHEROMONE_SPREAD);
            this.pheromoneStrength -= Ant.PHEROMONE_DECAY;
        }
    };
    // Random angle adjustment every frame if not following a scent.
    Ant.WIGGLE = 0.3;
    Ant.SPEED = 0.5;
    Ant.TURN_SPEED = 0.2;
    // Ants drop 1.0 pheromone scent minus a decay for each frame they are away from 
    // the nest.
    Ant.PHEROMONE_DECAY = 0.001;
    // How far each drop of scent spreads, in pixels.
    Ant.PHEROMONE_SPREAD = 3;
    // How quickly the pheromone evaporates.
    Ant.PHEROMONE_FADE = 0.0003;
    return Ant;
})();
/// <reference path="Actor.ts" />
var Food = (function () {
    function Food(pos, size) {
        this.pos = pos;
        this.size = size;
    }
    Food.MAX_SIZE = 20;
    return Food;
})();
/// <reference path="Actor.ts" />
var Nest = (function () {
    function Nest(pos, size) {
        this.pos = pos;
        this.size = size;
    }
    return Nest;
})();
/// <reference path="Actor.ts" />
/// <reference path="Ant.ts" />
/// <reference path="Food.ts" />
/// <reference path="Nest.ts" />
/// <reference path="Utils.ts" />
var Pheromones = (function () {
    function Pheromones(width, height) {
        this.nest = initialise2DArray(width, height, 0);
        this.food = initialise2DArray(width, height, 0);
    }
    return Pheromones;
})();
var World = (function () {
    function World(width, height, numAnts, numFood) {
        this.width = width;
        this.height = height;
        this.ants = new Array();
        for (var i = 0; i < numAnts; i++) {
            this.addAnt();
        }
        this.food = new Array();
        for (var i = 0; i < numFood; i++) {
            this.addFood();
        }
        this.pheromones = new Pheromones(this.width, this.height);
        this.nest = new Nest(new Vec(this.width / 2, this.height / 2), 20);
    }
    World.prototype.addAnt = function () {
        this.ants.push(new Ant(new Vec(this.width / 2, this.height / 2), this));
    };
    World.prototype.addFood = function () {
        this.food.push(new Food(new Vec(Math.random() * this.width, Math.random() * this.height), 1 + Math.floor(Math.random() * Food.MAX_SIZE - 1)));
    };
    World.prototype.update = function () {
        for (var i = 0; i < this.ants.length; i++) {
            this.ants[i].update();
        }
        this.updatePheromones();
    };
    World.prototype.dropPheromone = function (pheromoneType, pos, strength, spread) {
        var pheromones = this.pheromoneForType(pheromoneType);
        var x = Math.floor(pos.x);
        var y = Math.floor(pos.y);
        // Spread over larger area than a single point, decreasing in strength away from center.
        for (var i = x - spread; i < x + spread; i++) {
            var divisorX = Math.abs(i - x) + 1;
            for (var j = y - spread; j < y + spread; j++) {
                var divisorY = Math.abs(j - y) + 1;
                if (this.pointInside(i, j)) {
                    pheromones[i][j] = Math.min(1, pheromones[i][j] + strength / (3 * divisorX * divisorY));
                }
            }
        }
    };
    World.prototype.getPheromoneAt = function (pos, pheromoneType) {
        if (!this.pointInside(pos.x, pos.y)) {
            return 0;
        }
        return this.pheromoneForType(pheromoneType)[Math.floor(pos.x)][Math.floor(pos.y)];
    };
    World.prototype.foodAtPos = function (pos) {
        for (var i = 0; i < this.food.length; i++) {
            var food = this.food[i];
            if (pos.insideCircle(food.pos.x, food.pos.y, food.size / 2)) {
                return food;
            }
        }
        return null;
    };
    World.prototype.pheromoneForType = function (pheromoneType) {
        return pheromoneType == PheromoneType.Nest ? this.pheromones.nest : this.pheromones.food;
    };
    World.prototype.pointInside = function (x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return false;
        }
        return true;
    };
    World.prototype.updatePheromones = function () {
        for (var x = 0; x < this.width; ++x) {
            for (var y = 0; y < this.height; ++y) {
                this.pheromones.nest[x][y] -= Ant.PHEROMONE_FADE;
                this.pheromones.nest[x][y] = Math.max(this.pheromones.nest[x][y], 0);
                this.pheromones.food[x][y] -= Ant.PHEROMONE_FADE;
                this.pheromones.food[x][y] = Math.max(this.pheromones.food[x][y], 0);
            }
        }
    };
    return World;
})();
/// <reference path="Renderer.ts" />
/// <reference path="World.ts" />
(function (window, canvas) {
    var renderer = new Renderer(canvas);
    var world = new World(canvas.width, canvas.height, 300, 50);
    var tick = function () {
        world.update();
        renderer.render(world.ants, world.food, world.nest, world.pheromones.nest, world.pheromones.food);
    };
    window.setInterval(tick, 1);
}(this, document.getElementById("simulation")));
