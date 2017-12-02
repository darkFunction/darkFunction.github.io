var allSides = [0 /* Top */, 1 /* Left */, 2 /* Bottom */, 3 /* Right */];
var Size = (function () {
    function Size(width, height) {
        this.width = width;
        this.height = height;
    }
    return Size;
})();
var Pin = (function () {
    function Pin(side, index) {
        this.side = side;
        this.index = index;
    }
    Pin.random = function (dimensions, excludingSide) {
        var sides = allSides;
        if (excludingSide != null) {
            sides = allSides.slice(0);
            sides.splice(sides.indexOf(excludingSide, 0), 1);
        }
        var side = sides[Math.floor(Math.random() * (sides.length))];
        var maxIndex = side == 0 /* Top */ || side == 2 /* Bottom */ ? dimensions.width : dimensions.height;
        return new Pin(side, Math.floor(Math.random() * maxIndex));
    };
    Pin.prototype.copy = function () {
        return new Pin(this.side, this.index);
    };
    return Pin;
})();
var Line = (function () {
    function Line(fromPin, toPin) {
        this.fromPin = fromPin;
        this.toPin = toPin;
    }
    Line.prototype.copy = function () {
        return new Line(this.fromPin.copy(), this.toPin.copy());
    };
    return Line;
})();
var Painting = (function () {
    function Painting(spec) {
        this.spec = spec;
        this.lines = new Array();
        this.pinDimensions = new Size(spec.width / spec.pinSpacing, spec.height / spec.pinSpacing);
    }
    Painting.pinCoords = function (painting, pin) {
        var px = 0;
        var py = 0;
        if (pin.side == 0 /* Top */ || pin.side == 2 /* Bottom */) {
            py = pin.side == 0 /* Top */ ? 0 : painting.spec.height - 1;
            px = pin.index * painting.spec.pinSpacing;
        }
        else {
            px = pin.side == 1 /* Left */ ? 0 : painting.spec.width - 1;
            py = pin.index * painting.spec.pinSpacing;
        }
        return [px, py];
    };
    return Painting;
})();
var allSidesExcludingSide = function (side) {
    var sides = allSides.slice(0);
    sides.splice(sides.indexOf(side, 0), 1);
    return sides;
};
function forEachPixelBetweenPoints(x0, y0, x1, y1, callback) {
    var dx = Math.abs(x1 - x0);
    var dy = Math.abs(y1 - y0);
    var sx = (x0 < x1) ? 1 : -1;
    var sy = (y0 < y1) ? 1 : -1;
    var err = dx - dy;
    while (true) {
        callback(x0, y0);
        if ((x0 == x1) && (y0 == y1))
            break;
        var e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x0 += sx;
        }
        if (e2 < dx) {
            err += dx;
            y0 += sy;
        }
    }
}
function forEachPixelOnLine(line, painting, callback) {
    var fromPoint = Painting.pinCoords(painting, line.fromPin);
    var toPoint = Painting.pinCoords(painting, line.toPin);
    forEachPixelBetweenPoints(fromPoint[0], fromPoint[1], toPoint[0], toPoint[1], callback);
}
function getLineScore(painting, imageData, line) {
    var count = 0;
    var total = 0;
    var darkestPixel = 255 * 3;
    forEachPixelOnLine(line, painting, function (x, y) {
        var dataIndex = y * (imageData.width * 4) + (x * 4);
        var pixelValue = (imageData.data[dataIndex] + imageData.data[dataIndex + 1] + imageData.data[dataIndex + 2]);
        total += pixelValue;
        count++;
    });
    return (total / count);
}
var nextLine = function (painting, originalImage, fromPin) {
    var toPin = Pin.random(painting.pinDimensions, null);
    var bestScore = 255 * 3;
    var sides = allSidesExcludingSide(fromPin.side);
    for (var sideIndex = 0; sideIndex < sides.length; sideIndex++) {
        var side = sides[sideIndex];
        var pinCount = (side == 0 /* Top */ || side == 2 /* Bottom */) ? painting.pinDimensions.width : painting.pinDimensions.height;
        for (var pinIndex = 0; pinIndex < pinCount; pinIndex++) {
            var line = new Line(fromPin, new Pin(side, pinIndex));
            var lineScore = getLineScore(painting, originalImage, line);
            if (lineScore < bestScore) {
                bestScore = lineScore;
                toPin = line.toPin;
            }
        }
    }
    return new Line(fromPin, toPin);
};
var putPixel = function (imageData, x, y, rgba) {
    var i = y * (imageData.width * 4) + (x * 4);
    imageData.data[i] = rgba[0];
    imageData.data[i + 1] = rgba[1];
    imageData.data[i + 2] = rgba[2];
    imageData.data[i + 3] = rgba[3];
};
onmessage = function (event) {
    if (event.data.cmd == "start") {
        var spec = event.data.paintingSpec;
        var painting = new Painting(spec);
        var originalImage = event.data.imageData;
        var startPin = new Pin(1 /* Left */, 0);
        var line = null;
        for (var i = 0; i < spec.numLines; i++) {
            line = nextLine(painting, originalImage, line == null ? startPin : line.toPin);
            painting.lines.push(line);
            forEachPixelOnLine(line, painting, function (x, y) {
                var dataIndex = y * (originalImage.width * 4) + (x * 4);
                var pixelValue = (originalImage.data[dataIndex] + originalImage.data[dataIndex + 1] + originalImage.data[dataIndex + 2]);
                var colourIncrement = 255 * spec.darkness;
                putPixel(originalImage, x, y, [originalImage.data[dataIndex] + colourIncrement, originalImage.data[dataIndex + 1] + colourIncrement, originalImage.data[dataIndex + 2] + colourIncrement, 255]);
            });
            this.postMessage(painting);
        }
    }
};
