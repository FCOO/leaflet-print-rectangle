# leaflet-print-rectangle
>
[Modernizr]: https://modernizr.com/


## Description

Add a `L.PrintRectangle` component to leaflet to mark a fixed-ratio area on the map witch is to be printed
The width-height-ratio of the rectangle is default 3/2 (landscape) but can be changed with `setRatio()`

When the rectangle is being dragged the marker on the other side of the rectangle relative to the marker being dragged is fixed and the new size is calculated acording to this fixed point
Eq. if the NW-marker is dragged then the SE-marker is fixed.

Also include and setting a [Modernizr]-test named `leaflet-print-rectangle` and cooresponding show/hide-classes `show-for-leaflet-print-rectangle`, `hide-for-leaflet-print-rectangle`

## Installation
### bower
`bower install https://github.com/FCOO/leaflet-print-rectangle.git --save`

## Demo
http://FCOO.github.io/leaflet-print-rectangle/demo/ 

## Usage
```var myPrintRectangle = new PrintRectangle( options );```

### options
| Id | Type | Default | Description |
| :--: | :--: | :-----: | --- |
| `ratio` | float | 3/2 | The width-height-ratio of the rectangle |
| `allowRotate` | boolean | true | If <code>true</code> the ratio of the rectangle can be reversed (2/3 -> 3/2) by clicking the rectangle |
| `markerDim` | number | 20 | The dimention of the corener and center markers |

### Methods and properties

    .setRatio( ratio, keepMode ): Sets the widht-hight-ratio of the rectangle. if keepMode == true the ratio is rotated to keep the landscape/portrait-mode
    .rotate(): Rotate the rectangle
	.remove(): Remove the rectangle from the map

	.whRatio    : The current ratio
	.isLandscape: true if .whRatio > 1
	
	.southWest  : latLng for bottom-left corner
	.northWest  : latLng for top-left corner
	.northEast  : latLng for top-right corner
	.southEast  : latLng for bottom-right corner




## Copyright and License
This plugin is licensed under the [MIT license](https://github.com/FCOO/leaflet-print-rectangle/LICENSE).

Copyright (c) 2015 [FCOO](https://github.com/FCOO)

## Contact information

NielsHolt nho@fcoo.dk
