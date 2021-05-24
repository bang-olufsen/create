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
 
 // BEOCREATE UI DRAG ENGINE.
 // No dependencies.
 
 function Beodrag(element, options, context = document) {
 	var myThis = this;
 	this.element = element;
 	this.context = context;
 	
 	this.options = {
 		touchImmediately: false,
 		preventClick: false,
 		touchDelay: 300,
 		enabled: true,
 		arrange: false,
 		pre: null,
 		start: null,
 		move: null,
 		end: null,
 		cancel: null
 	};
 	this.options = Object.assign(this.options, options);
 	if (!options.pre || typeof options.pre != "function") this.options.pre = null;
 	if (!options.start || typeof options.start != "function") this.options.start = null;
 	if (!options.move || typeof options.move != "function") this.options.move = null;
 	if (!options.end || typeof options.end != "function") this.options.end = null;
 	if (!options.cancel || typeof options.cancel != "function") this.options.cancel = null;
 	
 	var elements = null;
 	var elementFound = false;
 	var dragEvent = null;
	var dragging = 0;
	var dragTimeout = null;
	var clickHandler = null;
	var touch = false;
	var positions = {
		elementX: 0, // Position of the element including offsets.
		elementY: 0,
		pageX: 0,
		pageY: 0,
		offsetX: 0, // Calculated offset (element position - drag position + margin).
		offsetY: 0,
		deltaX: 0,
		deltaY: 0,
		startX: 0,
		startY: 0
	};
	
 	
 	this.onDragStart = function(event) {
 		if (this.options.enabled) {
 			dragging = false;
 			elements = this.context.querySelectorAll(this.element);
	 		elementFound = false;
	 		for (element in elements) {
		 		if (elements[element] == event.target) {
		 			elementFound = true;
		 			break;
		 		}
		 	}
	 		if (elementFound) {
		 		dragEvent = event;
	 			dragging = 0;
				touch = (event.targetTouches) ? true : false;
				if (!touch) {
					positions.pageX = dragEvent.pageX;
					positions.pageY = dragEvent.pageY;
					event.preventDefault();
				} else {
					positions.pageX = event.targetTouches[0].pageX;
					positions.pageY = event.targetTouches[0].pageY;
					if (this.options.touchImmediately) event.preventDefault();
				}
				positions.startX = positions.pageX;
				positions.startY = positions.pageY;
				domRect = event.target.getBoundingClientRect();
				computedStyle = window.getComputedStyle(event.target);
				positions.offsetX = positions.pageX-domRect.x+parseFloat(computedStyle.marginLeft);
				positions.offsetY = positions.pageY-domRect.y+parseFloat(computedStyle.marginTop);
				positions.elementX = positions.pageX-positions.offsetX;
				positions.elementY = positions.pageY-positions.offsetY;
				if (!this.options.touchImmediately) {
					dragTimeout = setTimeout(function() {
						dragTimeout = null;
						if (myThis.options.pre) myThis.options.pre(event, positions, dragEvent.target);
						dragging = 1;
					}, this.options.touchDelay);
				} else {
					if (this.options.pre) this.options.pre(event, positions, dragEvent.target);
					dragging = 1;
				}
			}
		}
 	}
 	this.onDragMove = function(event) {
 		if (dragEvent) {
			if (dragging < 2) {
				if (!touch) {
					clearTimeout(dragTimeout);
					dragTimeout = null;
				}
				if (!dragTimeout) {
					dragging = 2;
					if (this.options.start) this.options.start(event, positions, dragEvent.target);
					if (this.options.arrange) this.arrangeStart(event);
					event.preventDefault();
				} else {
					this.onDragEnd(event, true);
				}
			} else if (dragging == 2) {
				event.preventDefault();
				if (!touch) {
					x = event.pageX;
					y = event.pageY;
				} else {
					x = event.targetTouches[0].pageX;
					y = event.targetTouches[0].pageY;
				}
				if (x != positions.pageX || y != positions.pageY) {
					positions.pageX = x;
					positions.pageY = y;
					positions.deltaX = x-positions.startX;
					positions.deltaY = y-positions.startY;
					positions.elementX = positions.pageX-positions.offsetX;
					positions.elementY = positions.pageY-positions.offsetY;
					if (this.options.move) this.options.move(event, positions, dragEvent.target);
					if (this.options.arrange) this.arrangeMove(event);
				}
			}
		}
 	}
 	
 	
 	this.onDragEnd = function(event, fromDrag = false) {
 		if (dragging == 2) {
			//dragging = false;
			if (this.options.arrange) {
				this.arrangeEnd(event);
			} else if (this.options.end) {
				this.options.end(event, positions, dragEvent.target);
			}
			dragEvent = null;
			event.preventDefault();
		} else if (dragging == 0) {
			// Do nothing.
			dragEvent = null;
			clearTimeout(dragTimeout);
		} else if (dragEvent) {
			if (this.options.cancel) this.options.cancel(event, positions, dragEvent.target);
			dragEvent = null;
			if (!fromDrag) event.preventDefault();
			clearTimeout(dragTimeout);
			dragTimeout = null;
		}
 	}
 	
 	this.onClick = function(event) {
 		if (elementFound) {
 			if (this.options.preventClick || dragging > 0) {
	 			dragging = 0;
	 			elementFound = false;
	 			event.stopPropagation();
	 		}
 		}
 	}
 	
 	this.onContextMenu = function(event) {
 		if (elementFound) {
 			this.onDragEnd(event, true);
 		}
 	}
 	
 	this.context.addEventListener("mousedown", this.onDragStart.bind(this), false);
 	this.context.addEventListener("mousemove", this.onDragMove.bind(this), false);
 	document.addEventListener("mouseup", this.onDragEnd.bind(this), false);
 	
 	this.context.addEventListener("touchstart", this.onDragStart.bind(this), false);
 	this.context.addEventListener("touchmove", this.onDragMove.bind(this), {passive: false, capture: false});
 	this.context.addEventListener("touchend", this.onDragEnd.bind(this), false);
 	
 	this.context.addEventListener("click", this.onClick.bind(this), {passive: false, capture: true});
 	this.context.addEventListener("contextmenu", this.onContextMenu.bind(this), {passive: false, capture: true});
 	
 	
 	var itemPositions = [];
	var currentPosition = 0;
	var newPosition = 0;
	var itemHeight = 0;
	
 	this.arrangeStart = function(event) {
		itemHeight = dragEvent.target.getBoundingClientRect().height;
		itemPositions = [];
		for (var i = 0; i < elements.length; i++) {
			itemPositions.push(elements[i].getBoundingClientRect().top);
			if (elements[i] == dragEvent.target) currentPosition = i;
		}
		newPosition = currentPosition;
 	}
 	
 	this.arrangeMove = function(event) {
 		dragEvent.target.style.transform = "translateY("+positions.deltaY+"px)";
		newY = itemPositions[currentPosition]+positions.deltaY;
		for (pos in itemPositions) {
			if (itemPositions[pos] < newY+itemHeight/2) newPos = parseFloat(pos);
		}
		if (newPos != newPosition) {
			for (pos in itemPositions) {
				if (pos != currentPosition) {
					if (newPos > currentPosition) { // Moving down.
						if (newPos >= pos && pos > currentPosition) {
							oldItemDeltaY = itemPositions[pos-1]-itemPositions[pos];
							elements[pos].style.transform = "translateY("+oldItemDeltaY+"px)";
						} else {
							elements[pos].style.transform = null;
						}
					} else if (newPos < currentPosition) { // Moving up.
						if (newPos <= pos && pos < currentPosition) {
							oldItemDeltaY = itemPositions[parseInt(pos)+1]-itemPositions[pos];
							elements[pos].style.transform = "translateY("+oldItemDeltaY+"px)";
						} else {
							elements[pos].style.transform = null;
						}
					} else {
						elements[pos].style.transform = null;
					}
				}
			}
			newPosition = newPos;
		}
 	}
 	
 	this.arrangeEnd = function(event) {
 		if (newPosition != currentPosition) {
			newDeltaY = itemPositions[newPosition]-itemPositions[currentPosition];
			dragEvent.target.style.transform = "translateY("+newDeltaY+"px)";
			// Run end
			if (this.options.end) this.options.end(event, positions, dragEvent.target, currentPosition, newPosition, elements);
		} else {
			dragEvent.target.style.transform = null;
			if (this.options.end) this.options.end(event, positions, dragEvent.target);
		}
 	}
 }
 
 
 Beodrag.prototype.setOptions = function(options) {
 	this.options = Object.assign(this.options, options);
 	return this.options;
 }