/// <reference path="Worker.ts" />
var ImageTool = (function () {
    function ImageTool() {
    }
    // Returns a number. Lower is better, 0 means matched exactly.
    ImageTool.compareImages = function (a, b) {
        if (a.width != b.width || a.height != b.height) {
            console.error("Trying to compare two differently sized images");
        }
        var diff = 0;
        for (var i = 0, n = a.data.length; i < n; i += 4) {
            //if ((i+1) % 4 == 0) { continue; } // ignore alpha channel
            var atotal = a.data[i] + a.data[i + 1] + a.data[i + 2];
            var btotal = b.data[i] + b.data[i + 1] + b.data[i + 2];
            diff += Math.abs(atotal - btotal);
        }
        return diff;
    };
    return ImageTool;
})();
var Renderer = (function () {
    function Renderer() {
    }
    Renderer.render = function (canvas, painting) {
        var context = canvas.getContext("2d");
        context.lineWidth = 1;
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.strokeStyle = 'rgba(0,0,0,' + painting.spec.darkness + ')';
        for (var i = 0; i < painting.lines.length; i++) {
            context.beginPath();
            var line = painting.lines[i];
            var start = Painting.pinCoords(painting, line.fromPin);
            var end = Painting.pinCoords(painting, line.toPin);
            context.moveTo(start[0], start[1]);
            context.lineTo(end[0], end[1]);
            context.stroke();
        }
    };
    return Renderer;
})();
var worker = null;
function generate(lineDrawingCanvas, originalCanvas, pinSpacing, numLines, darkness, filename) {
    var originalImage = new Image();
    originalImage.onload = function () {
        lineDrawingCanvas.width = originalImage.width;
        lineDrawingCanvas.height = originalImage.height;
        originalCanvas.width = originalImage.width;
        originalCanvas.height = originalImage.height;
        var originalContext = originalCanvas.getContext("2d");
        originalContext.drawImage(originalImage, 0, 0);
        if (worker != null) {
            worker.terminate();
        }
        worker = new Worker("/frameart/worker.js");
        worker.onmessage = function (event) {
            var painting = event.data;
            Renderer.render(lineDrawingCanvas, painting);
        };
        worker.postMessage({
            cmd: "start",
            paintingSpec: {
                width: originalCanvas.width,
                height: originalCanvas.height,
                pinSpacing: pinSpacing,
                numLines: numLines,
                darkness: darkness
            },
            imageData: originalContext.getImageData(0, 0, originalImage.width, originalImage.height)
        });
    };
    originalImage.src = filename;
}
//generate(document.getElementById("lineDrawing"), document.getElementById("original"))
