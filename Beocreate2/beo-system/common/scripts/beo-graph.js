 /*Copyright 2018-2020 Bang & Olufsen A/S
 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:
 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.
 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.*/
 
 function Beograph(container, options) {
	self = this;
	this.container = container;
	this.graphs = [
		{data: [], show: true, fill: false, lineWidth: 1, offset: 0},
		{data: [], show: true, fill: false, lineWidth: 1, offset: 0},
		{data: [], show: true, fill: false, lineWidth: 1, offset: 0},
		{data: [], show: true, fill: false, lineWidth: 1, offset: 0},
		{data: [], show: true, fill: false, lineWidth: 1, offset: 0}
	];
	this.pi = Math.PI;
	this.Fs = 48000;
	
	this.palette = [];
	this.darkPalette = [];
	this.darkFadedPalette = [];
	this.fadedPalette = [];
	this.resolution = (options.resolution) ? options.resolution : 256;
	
	$("#"+container).append('<div class="graph-content" id="graph-content-'+container+'" style="position: absolute; width: 100%; height: 100%;"></div>\
	<div class="graph-labels-x" style="position: absolute; width: 100%; top: 50%;"></div>\
	<div class="graph-labels-y" style="position: absolute; width: 100%;">\
	</div><div class="graph-handle hidden" title="Move to adjust filter frequency or gain"></div><div class="graph-handle-width hidden" title="Move to adjust filter width"><div class="left graph-handle-width-drag"></div><div class="right graph-handle-width-drag"></div></div><div class="graph-tooltip"></div>');
	
	if (options.labels) {
		if (options.labels.frequency) {
			$("#"+container+" .graph-labels-x").append('<div class="x-0 label">10 Hz</div>\
				<div class="x-1 label">100</div>\
				<div class="x-2 label">1k</div>\
				<div class="x-3 label">10k</div>');
		}
		
		if (options.labels.gain) {
			$("#"+container+" .graph-labels-y").append('<div class="y-a-0 label"></div>\
				<div class="y-a-1 label"></div>');
		}
		
		if (options.labels.phase) {
			$("#"+container+" .graph-labels-y").append('<div class="y-b-0 label phase">180°</div>\
				<div class="y-b-1 label phase">–180°</div>');
		}
	}
	
	if (!options.colours) options.colours = [];
	if (!options.coloursDark) options.coloursDark = [];
	if (!options.scale) options.scale = 15;
	if (options.grid == undefined) options.grid = true;
	
	
	this.setOptions(options);
	
	
	this.onResize = function(event) {
		this.draw();
	}
	window.addEventListener("resize", this.onResize.bind(this), false);
	
	this.calculateMasterGraph = function(fromGraph, withOffset) {
		// Sum all subgraphs.
		res = 0;
		for (var a = 0; a < this.graphs[fromGraph].data.length; a++) {
			if (this.graphs[fromGraph].data[a] && this.graphs[fromGraph].data[a].length > res) res = this.graphs[fromGraph].data[a].length;
		}
		master = [];
		for (var i = 0; i < res; i++) {
			plotPoint = 0;
			plotPhasePoint = 0;
			plotFreq = null;
			for (var a = 0; a < this.graphs[fromGraph].data.length; a++) {
				if (this.graphs[fromGraph].data[a]) {
					plotFreq = this.graphs[fromGraph].data[a][i][0];
					plotPoint += this.graphs[fromGraph].data[a][i][1];
				}
			}
			plotPoint += withOffset;
			master.push([plotFreq, plotPoint]);
		}
		return master;
	}
}

Beograph.prototype.setOptions = function(options, autoDraw) {
	
	if (options.colours != undefined) {
		for (var i = 0; i < options.colours.length; i++) {
			if (options.colours[i] != null) {
				this.palette[i] = options.colours[i];
				if (options.colours[i].charAt(0) == "#") {
					rgb = hexToRGB(options.colours[i]);
					if (rgb) this.fadedPalette[i] = "rgba("+rgb.join(",")+",0.3)";
				}
			}
		}
	}
	if (options.coloursDark != undefined) {
		if (options.coloursDark) {
			for (var i = 0; i < options.coloursDark.length; i++) {
				if (options.coloursDark[i] != null) {
					this.darkPalette[i] = options.coloursDark[i];
					if (options.coloursDark[i].charAt(0) == "#") {
						rgb = hexToRGB(options.coloursDark[i]);
						if (rgb) this.darkFadedPalette[i] = "rgba("+rgb.join(",")+",0.3)";
					}
				}
			}
		}
	}
	
	if (options.grid != undefined) this.grid = options.grid;
	
	if (options.scale != undefined) {
		this.scale = options.scale;
		$("#"+this.container+" .graph-labels-y .y-a-0").text('+'+this.scale+' dB');
		$("#"+this.container+" .graph-labels-y .y-a-1").text('-'+this.scale+' dB');
	}
	
	if (options.resolution != undefined) {
		this.resolution = options.resolution;
	}
	
	if (options.Fs != undefined) {
		this.Fs = options.Fs;
	}
	
	function hexToRGB(hex) {
	    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
	    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
	    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
	        return r + r + g + g + b + b;
	    });
	
	    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	    return result ? [
	        parseInt(result[1], 16),
			parseInt(result[2], 16),
	        parseInt(result[3], 16)
	    ] : null;
	}
	
	if (autoDraw) this.draw();
}

Beograph.prototype.store = function(target, options, autoDraw) {
	
	points = null;
	if (options.coefficients) {
		// Plot these coefficients.
		a0 = options.coefficients[0];
		a1 = options.coefficients[1];
		a2 = options.coefficients[2];
		b0 = options.coefficients[3];
		b1 = options.coefficients[4];
		b2 = options.coefficients[5];
		
		points = [];
		
		for (var i = 0; i < this.resolution; i++) {
			freq = logScale(i / this.resolution, 0.0001, 0.5);
			z = freq*this.Fs;
			w = freq * 2 * this.pi;
			fi = Math.pow(Math.sin(w/2), 2);
			y = Math.log(Math.pow(b0+b1+b2, 2) - 4 * (b0*b1 + 4*b0*b2 + b1*b2) * fi + 16*b0*b2*fi*fi) - Math.log(Math.pow(1+a1+a2, 2) - 4 * (a1 + 4*a2 + a1*a2)*fi + 16*a2*fi*fi);
			y = y * 10 / Math.LN10;
			if (isNaN(y)) y = -200;
			points.push([z, y]);
		}
	}
	
	if (options.data) {
		// Readily crunched data points.
		points = options.data;
	}
	
	
	// Target accepts an array:
	// [2] subgraph 0 of graph 2, delete others
	// [[2, 3]] subgraph 3 of graph 2, preserve others
	// [[2, 3], 2] both of above
	
	for (var i = 0; i < target.length; i++) {
		if (typeof target[i] == "number") {
			targetGraph = target[i];
			targetSubgraph = 0;
		}
		if (typeof target[i] == "object") {
			targetGraph = target[i][0];
			targetSubgraph = target[i][1];
			
		}
		recalculateMaster = false;
		if (options.offset != undefined) {
			if (options.offset != this.graphs[targetGraph].offset) recalculateMaster = true; 
			this.graphs[targetGraph].offset = options.offset;
		}
		
		if (options.clearData) {
			this.graphs[targetGraph].data = [];
			delete this.graphs[targetGraph].master;
		} else if (points) {
			recalculateMaster = true;
			this.graphs[targetGraph].data[targetSubgraph] = points;
			
			if (this.graphs[targetGraph].data.length == 0) {
				delete this.graphs[targetGraph].master;
				recalculateMaster = false;
			}
		}
		
		if (recalculateMaster) {
			this.graphs[targetGraph].master = this.calculateMasterGraph(targetGraph, this.graphs[targetGraph].offset);
		}
		
		if (options.colour != undefined) {
			this.graphs[targetGraph].colour = options.colour;
		}
		if (options.show != undefined) {
			this.graphs[targetGraph].show = (options.show) ? true : false;
		}
		if (options.faded != undefined) {
			this.graphs[targetGraph].faded = (options.faded) ? true : false;
		}
		if (options.fill != undefined) { // Fill uses the same colour as the line.
			this.graphs[targetGraph].fill = (options.fill) ? true : false;
		}
		if (options.lineWidth != undefined) { // Fill uses the same colour as the line.
			this.graphs[targetGraph].lineWidth = options.lineWidth;
		}
	}
	
	
	if (autoDraw) this.draw();
	
	function logScale(value, min, max) {
		return Math.pow(2, Math.log(max / min) / Math.LN2 * value) * min;
	}
}

Beograph.prototype.copyData = function(source, target, autoDraw) {
	// Target accepts an array:
	// [2] subgraph 0 of graph 2, delete others
	// [[2, 3]] subgraph 3 of graph 2, preserve others
	// [[2, 3], 2] both of above
	wholeGraph = false;
	if (typeof source[0] == "number") {
		data = this.graphs[source[0]].data;
		wholeGraph = true;
	}
	if (typeof source[0] == "object") {
		data = this.graphs[source[0][0]].data[source[0][1]];
	}
	for (var i = 0; i < target.length; i++) {
		if (typeof target[i] == "number") {
			targetGraph = target[i];
			targetSubgraph = 0;
			wholeGraphTarget = true;
		}
		if (typeof target[i] == "object") {
			targetGraph = target[i][0];
			targetSubgraph = target[i][1];
			wholeGraphTarget = false;
		}
		
		if (wholeGraph) {
			this.graphs[targetGraph].data = data;
		} else {
			if (wholeGraphTarget) {
				this.graphs[targetGraph].data = [];
				this.graphs[targetGraph].data[targetSubgraph] = data;
			} else {
				this.graphs[targetGraph].data[targetSubgraph] = data;
			}
		}
		
		if (this.graphs[targetGraph].data.length == 0) {
			delete this.graphs[targetGraph].master;
			recalculateMaster = false;
		} else {
			recalculateMaster = true;
		}
		
		if (recalculateMaster) {
			this.graphs[targetGraph].master = this.calculateMasterGraph(targetGraph, this.graphs[targetGraph].offset);
		}
		
	}
	if (autoDraw) this.draw();
}

Beograph.prototype.draw = function() {
	if ($("#graph-content-"+this.container).is(":visible")) {
		dpRatio = window.devicePixelRatio;
		isDark = beo.isDarkAppearance();
		plots = [];
		colours = [];
		for (var i = 0; i < this.graphs.length; i++) {
			if (this.graphs[i].master && this.graphs[i].show) {
				if (!isDark) {
					colour = "#000";
					if (this.graphs[i].colour != undefined) {
						if (this.palette[this.graphs[i].colour]) {
							if (!this.graphs[i].faded) {
								colour = this.palette[this.graphs[i].colour];
							} else {
								colour = this.fadedPalette[this.graphs[i].colour];
							}
						}
					}
				} else {
					colour = "#fff";
					if (this.graphs[i].colour != undefined) {
						if (this.darkPalette[this.graphs[i].colour]) {
							if (!this.graphs[i].faded) {
								colour = this.darkPalette[this.graphs[i].colour];
							} else {
								colour = this.darkFadedPalette[this.graphs[i].colour];
							}
						} else if (this.palette[this.graphs[i].colour]) {
							if (!this.graphs[i].faded) {
								colour = this.palette[this.graphs[i].colour];
							} else {
								colour = this.fadedPalette[this.graphs[i].colour];
							}
						}
					}
				}
				colours.push(colour);
				plots.push({data: this.graphs[i].master, lines: {lineWidth: this.graphs[i].lineWidth, fill: this.graphs[i].fill}})
			}
		}
		
		xOptions = {scaling: "logarithmic", base: 10, ticks: [[100, "100"], [1000, "1k"], [10000, "10k"]], minorTicks: [20,30,40,50,60,70,80,90,200,300,400,500,600,700,800,900,2000,3000,4000,5000,6000,7000,8000,9000], min: 10, max: 20000, showLabels: false, margin: false};
		yOptions = {showLabels: false, max: this.scale, min: -this.scale, margin: false, ticks: [[20, "+20"], [15, ""],[10, "+10"], [5, ""], [0, "0"], [-5, ""], [-10, "-10"], [-15, ""], [-20, "-20"]]};
		y2Options = {showLabels: false, max: this.pi, min: -this.pi, margin: false, noTicks: 0};
		gridOptions = {tickColor: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.5)", outlineWidth: 0, labelMargin: 0};
		if (isDark) {
			gridOptions.tickColor = "rgba(255,255,255,0.05)"; 
			gridOptions.color = "rgba(255,255,255,0.5)";
		}
		if (!this.grid) gridOptions.tickColor = "rgba(0,0,0,0)";
		
		Flotr.draw(document.getElementById("graph-content-"+this.container), plots,
		{resolution: dpRatio, yaxis: yOptions, y2axis: y2Options, xaxis: xOptions, shadowSize: 0, grid: gridOptions, colors: colours});
	}
}

Beograph.prototype.getDimensions = function() {
	w = $("#"+this.container).innerWidth();
	h = $("#"+this.container).innerHeight();
	offset = $("#"+this.container).offset();
	return {w: w, h: h, x: offset.left, y: offset.top};
}