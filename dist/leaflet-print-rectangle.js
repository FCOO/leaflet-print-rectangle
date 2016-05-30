/****************************************************************************
	leaflet-print-rectangle.js,

	(c) 2016, FCOO

	https://github.com/FCOO/leaflet-print-rectangle
	https://github.com/FCOO

****************************************************************************/
;(function ($, L, window, document, undefined) {
	"use strict";

	//Codes to the select the nine marker (four corner + four sides + one center)o
	var posLeft = 1,	posCenter =  2,	posRight	=  4,
			posTop	= 8,	posMiddle = 16,	posBottom = 32,

	//lprPath = leaflet.Path for the rectangle
	lprPath = {
		stroke			: true,
		color				: 'white',
		weight			: 2,
		opacity			: 1,
		fill				: true,
		fillColor		: 'white',
		fillOpacity	: 0.1,
		clickable		: true
	},

	modernizrTestName = 'leaflet-print-rectangle';


	L.PrintRectangle = L.Class.extend({
		includes: L.Mixin.Events,

		options: {
			VERSION			: "1.0.1",
			ratio				: 3/2,
			allowRotate	: true,
			markerDim		: 20
		},

		/**************************************************************************************
		initialize
		**************************************************************************************/
		initialize: function(options) {
			L.setOptions(this, options);

			this.initSizeRatio	= 0.9; //The initial max size of the rectangle compair to the current map view
			this.minimumDim			= 3.6*this.options.markerDim;
			this.whRatio				= this.options.ratio;

	  },

		/**************************************************************************************
		addTo
		**************************************************************************************/
		addTo: function(map) {
			this.map = map;

			//Update modernizr-classes
			$('html').removeClass('no-'+modernizrTestName);
			$('html').addClass(modernizrTestName);

			//Create the L.Rectangle
			var mapBounds = map.getBounds();
			this.polygon = new L.polygon( [mapBounds.getSouthWest(), mapBounds.getNorthWest(), mapBounds.getNorthEast(), mapBounds.getSouthEast()], lprPath);

			//Create nine markers used for resize
			var h				= [posLeft, posCenter, posRight],
					hClass	= ['left', 'center', 'right'],
					v				= [posTop, posMiddle, posBottom],
					vClass	= ['top', 'middle', 'bottom'],
					iconAnchorX, iconAnchorY,
					markerOptions = {
						icon			: null,
						clickable	: true,
						draggable	: true,
						keyboard	: true
					},
					divIconOptions = {
						iconSize	: [this.options.markerDim, this.options.markerDim],
						iconAnchor: [0,0],
						className	: ''
					},
					nextResizeMarker;

			this.resizeMarkers = [];
			this.featureGroup = L.featureGroup();

			var resizeMarker_setPosByLeftTop = function( left, top ){
				this.setLatLng( this._map.containerPointToLatLng( [left,	top] ) );
			};

			for (var i=0; i<h.length; i++ )
				for (var j=0; j<v.length; j++ ){
					var type = h[i]+v[j];
					if (type & posLeft)		iconAnchorX = 0 + lprPath.weight;
					if (type & posCenter)	iconAnchorX =	this.options.markerDim/2;
					if (type & posRight)	iconAnchorX =	this.options.markerDim - lprPath.weight;

					if (type & posTop)		iconAnchorY =	0 + lprPath.weight;
					if (type & posMiddle)	iconAnchorY =	this.options.markerDim/2;
					if (type & posBottom)	iconAnchorY =	this.options.markerDim - lprPath.weight;

					divIconOptions.iconAnchor = [iconAnchorX,iconAnchorY];
					divIconOptions.className = 'lpr-marker ' + hClass[i] + ' ' + vClass[j];

					markerOptions.icon = L.divIcon(divIconOptions);
					nextResizeMarker = L.marker( [0,0], markerOptions);
					nextResizeMarker.type = type;
					nextResizeMarker._map = this.map;

					//Adding events to the marker
					nextResizeMarker.on( 'dragstart', this._marker_onDragStart, this );
					nextResizeMarker.on('drag',				this._marker_onDrag,			this);
					nextResizeMarker.on('dragend',		this._marker_onDragEnd,		this);

					nextResizeMarker._setPosByLeftTop = resizeMarker_setPosByLeftTop;

					this.resizeMarkers[type] = nextResizeMarker;
					this.featureGroup.addLayer( nextResizeMarker );
				}
			this.centerMarker = this.resizeMarkers[ posCenter + posMiddle ];
			this.fixedMarker = this.centerMarker;

			this.polygon.addTo(this.map);
			this.polygon.bringToFront();

			this.featureGroup.addTo(this.map);


			//Create four	shadow boxes/div
			this._container		= L.DomUtil.create("div", "lpr-container", this.map._controlContainer);
			this._topShade		= L.DomUtil.create("div", "lpr-shade", this._container);
			this._bottomShade	= L.DomUtil.create("div", "lpr-shade", this._container);
			this._leftShade		= L.DomUtil.create("div", "lpr-shade", this._container);
			this._rightShade	= L.DomUtil.create("div", "lpr-shade", this._container);

			//Prevent contextmenu on any shade
			L.DomEvent.addListener(this._container, 'contextmenu', L.DomEvent.stop);


			var pixelBounds	= this.map.getPixelBounds();
			this.pixelWidth		= this.initSizeRatio*pixelBounds.getSize().x;
			this.pixelHeight	= this.initSizeRatio*pixelBounds.getSize().y;

			//Adjust to fit ratio
			if (this.pixelWidth > this.pixelHeight*this.whRatio)
			  this.pixelWidth = this.pixelHeight*this.whRatio;
			else
				this.pixelHeight = this.pixelWidth/this.whRatio;

			this.center = (pixelBounds.max.x - pixelBounds.min.x)/2;
			this.middle	=	(pixelBounds.max.y - pixelBounds.min.y)/2;
			this._update();
			this.setRatio( this.whRatio );

			if (this.options.allowRotate){
				this.polygon.on('click', this.rotate, this);
			}

			//Add zoom-event to the map to update after map zoom
			this.map.on('drag', this._onMapChange, this);
			this.map.on('zoomend', this._onMapZoom, this);
	    this.map.on('moveend', this._onMapChange, this);
	    this.map.on('resize', this._onMapChange, this);

			return this;
		},

		/**************************************************************************************
		_update: Adjust the rectangle and the resizeMarkers by Calculate the left, right, top,
		bottom, center and middle of the rectangle based on pixelWidth, pixelHeight and the fixed marker
		**************************************************************************************/
		_update: function(){
			//Calculate the new left, right, top,, bottom, center and middle
			var fixedMarkerType = this.fixedMarker.type;

			var halfHeight = this.pixelHeight/2;
			var halfWidth = this.pixelWidth/2;

			if (fixedMarkerType & posMiddle){
				this.top		= this.middle - halfHeight;
				this.bottom = this.middle + halfHeight;
			}
			if (fixedMarkerType & posCenter){
				this.left		= this.center - halfWidth;
				this.right	= this.center + halfWidth;
			}

			if (fixedMarkerType & posTop)
				this.bottom = this.top + this.pixelHeight;

			if (fixedMarkerType & posBottom)
				this.top = this.bottom - this.pixelHeight;

			if (fixedMarkerType & posLeft)
				this.right = this.left + this.pixelWidth;

			if (fixedMarkerType & posRight)
				this.left = this.right - this.pixelWidth;


			this.center = this.left + ( this.right - this.left )/2;
			this.middle = this.top + ( this.bottom - this.top )/2;

			//Calculate the latLng-corners
			this.southWest = this.map.containerPointToLatLng( [this.left,		this.bottom] );
			this.northWest = this.map.containerPointToLatLng( [this.left,		this.top   ] );
			this.northEast = this.map.containerPointToLatLng( [this.right,	this.top   ] );
			this.southEast = this.map.containerPointToLatLng( [this.right,	this.bottom] );

			//Resize the polygon
			this.polygon.setLatLngs([ this.southWest, this.northWest, this.northEast, this.southEast ]);

			//Move the four corner markers
			this.resizeMarkers[posLeft  + posTop		]._setPosByLeftTop(this.left,		this.top		);
			this.resizeMarkers[posLeft	 + posBottom]._setPosByLeftTop(this.left,		this.bottom	);
			this.resizeMarkers[posRight + posTop		]._setPosByLeftTop(this.right,	this.top		);
			this.resizeMarkers[posRight + posBottom	]._setPosByLeftTop(this.right,	this.bottom	);

			//Move the resize marker on the four sides
			this.resizeMarkers[ posLeft		+ posMiddle ]._setPosByLeftTop(this.left,		this.middle	); //setLatLng( this.map.containerPointToLatLng( [this.left,	 this.middle	] ) );
			this.resizeMarkers[ posRight	+ posMiddle ]._setPosByLeftTop(this.right,	this.middle	); //setLatLng( this.map.containerPointToLatLng( [this.right,	 this.middle] ) );
			this.resizeMarkers[ posCenter	+ posTop		]._setPosByLeftTop(this.center,	this.top		); //setLatLng( this.map.containerPointToLatLng( [this.center, this.top		] ) );
			this.resizeMarkers[ posCenter	+ posBottom ]._setPosByLeftTop(this.center,	this.bottom	); //setLatLng( this.map.containerPointToLatLng( [this.center, this.bottom	] ) );

			//Move the center/midle marker
			this.resizeMarkers[ posCenter	+ posMiddle ]._setPosByLeftTop(this.center, this.middle); //setLatLng( this.map.containerPointToLatLng( [this.center, this.middle] ) );

			//Resize and move the shade-divs
			function setDimensions(element, dimension) {
				element.style.display = ((dimension.width > 0) && (dimension.height > 0)) ? 'block' : 'none';
				element.style.width		= dimension.width + "px";
				element.style.height	= dimension.height + "px";
				element.style.top			= dimension.top + "px";
				element.style.left		= dimension.left + "px";
				element.style.bottom	= dimension.bottom + "px";
				element.style.right		= dimension.right + "px";
			}

			var size = this.map.getSize();
			setDimensions(this._topShade,			{ width: size.x,						height: this.top,						top		: 0,				left	: 0 });
			setDimensions(this._bottomShade,	{ width: size.x,						height: size.y-this.bottom,	bottom: 0,				left	: 0 });
			setDimensions(this._leftShade,		{	width: this.left,					height: this.pixelHeight,		top		: this.top,	left	: 0 });
			setDimensions(this._rightShade,		{	width: size.x-this.right, height: this.pixelHeight,		top		: this.top,	right	: 0 });
		},



		/**************************************************************************************
		_calcPointBounds: Calculate the point/pixel position of the rectangle based on the (latLng)bounds
		**************************************************************************************/
		_calcPointBounds: function(){
			var NWPoint = this.map.latLngToContainerPoint( this.polygon.getBounds().getNorthWest() );
			var SEPoint = this.map.latLngToContainerPoint( this.polygon.getBounds().getSouthEast() );
			this.left = NWPoint.x;
			this.top = NWPoint.y;
			this.right = SEPoint.x;
			this.bottom = SEPoint.y;
			this.center = this.left + ( this.right - this.left )/2;
			this.middle = this.top + ( this.bottom - this.top )/2;

			this.pixelWidth = this.right - this.left;
			this.pixelHeight = this.bottom - this.top;
		},

		/**************************************************************************************
		_calcDrawPointBounds: Calculate the maximum border of the map eq the border of the rectangle
		wheb it is beeing dragged or moved
		**************************************************************************************/
		_calcDrawPointBounds: function(){
			this.maxBounds = this.map.options.maxBounds ? this.map.options.maxBounds : L.latLngBounds([-90, 180], [90, -180]);		//this.map.getBounds();
			var mapNWPoint = this.map.latLngToContainerPoint( this.maxBounds.getNorthWest() );
			var mapSEPoint = this.map.latLngToContainerPoint( this.maxBounds.getSouthEast() );
			this.dragLeft		= mapNWPoint.x;
			this.dragTop		= mapNWPoint.y;
			this.dragRight	= mapSEPoint.x;
			this.dragBottom	= mapSEPoint.y;
			this.dragWidth	= this.dragRight - this.dragLeft;
			this.dragHeight	= this.dragBottom - this.dragTop;
		},

		/**************************************************************************************
		_onMapChange:
		**************************************************************************************/
		_onMapChange: function (/*event*/){
			this._calcPointBounds();
		  this._update();
		},

		/**************************************************************************************
		_onMapZoom:
		**************************************************************************************/
		_onMapZoom: function ( /*event*/ ){
			this.setRatio( this.whRatio );
		},

		/**************************************************************************************
		_marker_onDragStart
		**************************************************************************************/
		_marker_onDragStart: function ( event ){
			this.dragMarker = event.target;
			this.isMoving = (this.dragMarker == this.centerMarker);

			this._calcPointBounds();
			this._calcDrawPointBounds();

			var halfHeight = this.pixelHeight/2,
					halfWidth = this.pixelWidth/2,
					dragMarkerType, fixedMarkerType,
					maxPixelHeight, maxPixelWidth;

			if (this.isMoving){
				this.dragLeft		+= halfWidth;
				this.dragTop		+= halfHeight;
				this.dragRight	-= halfWidth;
				this.dragBottom	-= halfHeight;
			}
			else {
				//Finding the fixed marker = the marker opposite
				dragMarkerType = this.dragMarker.type;
				fixedMarkerType =
					(dragMarkerType & (posCenter + posMiddle)) +
					(dragMarkerType & posTop		? posBottom	: 0) +
					(dragMarkerType & posBottom	? posTop		: 0) +
					(dragMarkerType & posLeft		? posRight	: 0) +
					(dragMarkerType & posRight	? posLeft		: 0);
				this.fixedMarker = this.resizeMarkers[ fixedMarkerType ];

				//Calculate the pointBounds that the dragging marker must stay inside
				dragMarkerType = event.target.type;

				//First find the maximum new pixelHeight and pixelWidth
				if (dragMarkerType & posTop)		maxPixelHeight = this.pixelHeight + this.top - this.dragTop;
				if (dragMarkerType & posBottom)	maxPixelHeight = this.pixelHeight + this.dragBottom - this.bottom;
				if (dragMarkerType & posMiddle)	maxPixelHeight = this.pixelHeight + 2*Math.min(this.top - this.dragTop , this.dragBottom - this.bottom);

				if (dragMarkerType & posLeft)		maxPixelWidth = this.pixelWidth + this.left - this.dragLeft;
				if (dragMarkerType & posRight)	maxPixelWidth = this.pixelWidth + this.dragRight - this.right;
				if (dragMarkerType & posCenter)	maxPixelWidth = this.pixelWidth + 2*Math.min(this.left - this.dragLeft , this.dragRight - this.right);

				//Adjust maxPixelWidth or maxPixelHeight to match the smallest
				if (maxPixelWidth > maxPixelHeight*this.whRatio)
					maxPixelWidth = maxPixelHeight*this.whRatio;
				else
					maxPixelHeight = maxPixelWidth/this.whRatio;

				//Adjust the range acording to witch marker that is dragged
				if (dragMarkerType & posTop){
					this.dragBottom	= this.bottom - this.minHeight;
					this.dragTop		= this.bottom - maxPixelHeight;
				}
				if (dragMarkerType & posBottom){
					this.dragTop		= this.top + this.minHeight;
					this.dragBottom	=	this.top + maxPixelHeight;
				}
				if (dragMarkerType & posLeft){
					this.dragLeft		= this.right - maxPixelWidth;
					this.dragRight	= this.right - this.minWidth;
				}
				if (dragMarkerType & posRight){
					this.dragLeft		= this.left + this.minWidth;
					this.dragRight	= this.left + maxPixelWidth;
				}

				if (dragMarkerType & posCenter){
					this.dragLeft		=	this.center;
					this.dragRight	= this.center;
				}
				if (dragMarkerType & posMiddle){
					this.dragTop			= this.middle;
					this.dragBottom	= this.middle;
				}
			}

			this.dragBounds = L.latLngBounds( this.map.containerPointToLatLng([this.dragLeft		, this.dragBottom])	/*southWest*/,
																				this.map.containerPointToLatLng([this.dragRight	, this.dragTop])			/*northEast*/
																			);
		},

		/**************************************************************************************
		_marker_onDrag
		**************************************************************************************/
		_marker_onDrag: function ( event ){
			var latLng = event.target.getLatLng();

			//First: Move the dragged marker inside the drag-bounds
			if (!this.dragBounds.contains( latLng )){
				//v = Math.max( Math.min(v, max), min)
				latLng.lat = Math.max( Math.min( latLng.lat, this.dragBounds.getNorth() ), this.dragBounds.getSouth() );
				latLng.lng = Math.max( Math.min( latLng.lng, this.dragBounds.getEast()  ), this.dragBounds.getWest()  );
			}

			if (this.isMoving){
				var centerPoint = this.map.latLngToContainerPoint( latLng );
				this.center = centerPoint.x;
				this.middle = centerPoint.y;
			}
			else {
				//Calculate the new pixelWidth and pixelHeight by using the dim of the box set by the fixed and the dragged marker
				var fixedPoint = this.map.latLngToContainerPoint( this.fixedMarker.getLatLng() );
				var dragPoint = this.map.latLngToContainerPoint( latLng );
				this.pixelWidth = Math.abs( fixedPoint.x - dragPoint.x);
				this.pixelHeight = Math.abs( fixedPoint.y - dragPoint.y);
				this.pixelWidth		= Math.max( this.pixelWidth, this.pixelHeight*this.whRatio);
				this.pixelHeight	= Math.max( this.pixelHeight, this.pixelWidth/this.whRatio);
			}

			//Calculate the new left, right, top,, bottom, center and middle
			this._update();
		},

		/**************************************************************************************
		_marker_onDragEnd
		**************************************************************************************/
		_marker_onDragEnd: function ( /*dragEndEvent*/ ){
			this.dragMarker = null;
			this.fixedMarker = this.centerMarker;
			this.isMoving = false;
		},

		/**************************************************************************************
		setRatio: sets the ratio and update the rectangle (if it is visible)
		**************************************************************************************/
		setRatio: function( ratio, keepMode ){
			if (keepMode)
			  if ( (this.isLandscape && (ratio < 1)) || (!this.isLandscape && (ratio >= 1)) )
			    ratio = 1/ratio;

			this.whRatio = ratio;
			this.isLandscape = ratio >= 1;
			this._calcPointBounds();

			if (this.whRatio > 1){
			  this.minHeight = this.minimumDim;
				this.minWidth = this.minHeight*this.whRatio;
			}
			else {
			  this.minWidth = this.minimumDim;
				this.minHeight = this.minWidth/this.whRatio;
			}

			//Use the longest side as new dim
			var dim = Math.max(this.pixelWidth, this.pixelHeight);
			if (this.whRatio < 1){
			  this.pixelHeight = dim;
				this.pixelWidth = this.pixelHeight*this.whRatio;
			}
			else {
			  this.pixelWidth = dim;
				this.pixelHeight = this.pixelWidth/this.whRatio;
			}

			//Adjust dim with max
			this._calcDrawPointBounds();

			//v = Math.max( Math.min(v, max), min)
			this.pixelHeight	= Math.max( this.minHeight, Math.min( this.pixelHeight, this.dragHeight) );
			this.pixelWidth		= Math.max( this.minWidth, Math.min( this.pixelWidth, this.dragWidth) );
			if (this.pixelWidth > this.pixelHeight*this.whRatio)
				this.pixelWidth = this.pixelHeight*this.whRatio;
			else
				this.pixelHeight = this.pixelWidth/this.whRatio;

			this._update();

			if (!this.maxBounds.contains( this.polygon.getBounds() ) ){
			  //Move the rectangle inside the map bounds
				this.middle = this.middle	+ Math.max(0, this.dragTop - this.top)		- Math.max(0, this.bottom - this.dragBottom);
				this.center = this.center	+ Math.max(0, this.dragLeft - this.left)	- Math.max(0, this.right - this.dragRight);
				this._update();
			}
		},

		/**************************************************************************************
		rotate: rotate the rectangle
		**************************************************************************************/
		rotate: function(){
			this.setRatio( 1/this.whRatio );
		},


		/**************************************************************************************
		remove
		**************************************************************************************/
		remove: function(){
			$('html').removeClass(modernizrTestName);
			$('html').addClass('no-'+modernizrTestName);

			this.map.off('zoomend', this._onMapZoom, this);
	    this.map.off('moveend', this._onMapChange, this);
	    this.map.off('resize', this._onMapChange, this);
	    this.map.off('drag', this._onMapChange, this);

			this.map.removeLayer(this.featureGroup);
			this.map.removeLayer(this.polygon);
			this._container.remove();
		},

	}); //end of L.PrintRectangle

	L.printRectangle = function(options) {
		return new L.PrintRectangle(options);
	};

	//Initialize/ready
	$(function() {
		$('html').addClass('no-'+modernizrTestName);
	});




}(jQuery, L, this, document));



