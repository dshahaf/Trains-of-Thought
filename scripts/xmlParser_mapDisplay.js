function colorToHex(color) {return "#"+toHex(color[0])+toHex(color[1])+toHex(color[2])}

function toHex(n) {
 n = parseInt(n,10);
 if (isNaN(n)) return "00";
 n = Math.max(0,Math.min(n,255));
 return "0123456789abcdef".charAt((n-n%16)/16)
      + "0123456789abcdef".charAt(n%16);
}

//===========================================================================
//Provides a Dictionary object for client-side java scripts
//===========================================================================

function Lookup(key) 
{
return(this[key]);
}

function Delete() 
{
for (c=0; c < Delete.arguments.length; c++) 
{
 this[Delete.arguments[c]] = null;
}
// Adjust the keys (not terribly efficient)
var keys = new Array()
for (var i=0; i<this.Keys.length; i++)
{
 if(this[this.Keys[i]] != null)
   keys[keys.length] = this.Keys[i];
}
this.Keys = keys;
}

function Add() 
{
for (c=0; c < Add.arguments.length; c+=2) 
{
 // Add the property
 this[Add.arguments[c]] = Add.arguments[c+1];
 // And add it to the keys array
 this.Keys[this.Keys.length] = Add.arguments[c];
}
}

function Dictionary() 
{
this.Add = Add;
this.Lookup = Lookup;
this.Delete = Delete;
this.Keys = new Array();
}

//============================================================================



function parser(xmlDoc) {
	var nodes = xmlDoc.getElementsByTagName("node");
	//document.write("nodes: " + nodes.length + "\n");
	var edges = xmlDoc.getElementsByTagName("edge");
	//document.write("edges: " + edges.length + "\n");
	var keys  = xmlDoc.getElementsByTagName("key");
	//document.write("keys: " + keys.length + "\n");
	var lines = new Dictionary();
	var Stops = new Dictionary();
	
	// create a dictionary of line objects with empty arrays to hold nodes
	// key = id
	var i, oneObject, x;
	for (i=0; i<keys.length; i++) {
		x = keys[i].attributes;
		if (x.getNamedItem("for").nodeValue == "edge") {
			oneObject = new Object();
			oneObject["name"] = x.getNamedItem("attr.name").nodeValue;
			var r = x.getNamedItem("color.r").nodeValue;
			var g = x.getNamedItem("color.g").nodeValue;
			var b = x.getNamedItem("color.b").nodeValue;
			oneObject["color"] = colorToHex([r,g,b]);
			oneObject["stops"] = new Array();
			//document.write(oneObject.color+ "\n");
			lines.Add(x.getNamedItem("id").nodeValue, oneObject);
			//document.write(lines.Keys.toString() +"\n");
		}
	}
	
	// convert xml node elements to a dictionary of javascript objects
	// key = id
	var j, y, stop, k, key, z,a,b,c;
	for (j=0; j<nodes.length; j++) {
		y = nodes[j].attributes;
		//document.write(y.getNamedItem("id").nodeValue +'\n');
		stop = new Object();
		//a = nodes[j];
		//b = a.childNodes[3];
		//document.write("childnode: " + b.attributes[0].nodeValue + '\n');
		//document.write("value : " + b.childNodes[0].nodeValue);
		for (k=0; k<nodes[j].childNodes.length; k++) {
			z = nodes[j].childNodes[k];
			if (z.tagName == "data") {
				key = z.attributes[0].nodeValue;
				stop[key] = z.childNodes[0].nodeValue;
				stop.neighbors = new Array();
				stop.id = y.getNamedItem("id").nodeValue;
				// dictionary of offsets with line as key and (offx, offy) as values
				stop.offsets = new Dictionary();
				stop.onLines = new Array();
				//document.write("data : " + key + " : " + stop[key] + '\n');
			}			
		}
		stop.marked = false;
		stop.labeled = false;
		Stops.Add(y.getNamedItem("id").nodeValue, stop);
		//document.write("keys: " + Stops.Keys.toString()+ '\n');
	}
	
	changeCoords(Stops, normalizeCoords);
	
	// iterate through edges to populate lines with stops
	// add incident edges as properties to nodes
	var src, dst, line, x, srcObj, dstObj, numEdge, center;
	for (i=0; i<edges.length; i++) {
		src = edges[i].attributes.getNamedItem("source").nodeValue;
		dst = edges[i].attributes.getNamedItem("target").nodeValue;
		
		// add neighboring nodes as an attribute to stop objects
		srcObj = Stops.Lookup(src);
		dstObj = Stops.Lookup(dst);
		srcObj.neighbors[srcObj.neighbors.length] = dstObj;
		dstObj.neighbors[dstObj.neighbors.length] = srcObj;
		
		
		numEdge = edges[i].getElementsByTagName("data").length;
		center = numEdge/2.0;
		//document.write(src + " , " + dst +'\n');
		var lineNum = 0;
		for (j=0; j<edges[i].childNodes.length; j++) {
			x = edges[i].childNodes[j];
			
			if (x.tagName == "data") {
				line = lines.Lookup(edges[i].childNodes[j].attributes[0].nodeValue);
				//document.write("line: " + line.name +'\n');
				line.stops[line.stops.length] = src;
				line.stops[line.stops.length] = dst;
				//document.write(line.stops.toString());
				
				// add the lines on which the node appears as an attribute (onLines) to the stop objects
				if (!contains(srcObj.onLines, edges[i].childNodes[j].attributes[0].nodeValue)) {
					srcObj.onLines[srcObj.onLines.length] = edges[i].childNodes[j].attributes[0].nodeValue;
				}
				if (!contains(dstObj.onLines, edges[i].childNodes[j].attributes[0].nodeValue)) {
					dstObj.onLines[dstObj.onLines.length] = edges[i].childNodes[j].attributes[0].nodeValue;
				}
				
				
				// edge offset for overlapping lines
				if (numEdge > 1) {
					
					//document.write(edges[i].attributes.getNamedItem("id").nodeValue);
					// get slope of edge
					var dy = parseFloat(srcObj.y) - parseFloat(dstObj.y);
					var dx = parseFloat(srcObj.x) - parseFloat(dstObj.x);
					
					// find the normal vector orthogonal to the edge
					var length = Math.sqrt(dy*dy + dx*dx);
					var norm = [-dy/length, dx/length];
					
					// offset edges based on number of overlapping lines
					var offset = center-lineNum-1;
					var offx = norm[0]*offset, offy = norm[1]*offset;
					//document.write("length"+ length);
					//document.write("offset:" + offset);
					//document.write("norm: " + norm);
					//document.write("offsets:" + [offx, offy]);
					srcObj.offsets.Add(edges[i].childNodes[j].attributes[0].nodeValue, [offx, offy]);
					dstObj.offsets.Add(edges[i].childNodes[j].attributes[0].nodeValue, [offx, offy]);
				}
				lineNum++;
 			}
		}
	}
	
	// remove duplicate stops and put the stops in order
	orderStops(lines, Stops);
	//document.write("Looks like orderStops works!\n");
	return lines;
}


function sortNode(a, b) {
	return parseInt(a.substring(1)) - parseInt(b.substring(1));
}

function orderStops(lines, Stops) {
	var i, j, lObj, sObj;
	for (i=0; i<lines.Keys.length; i++) {
		lObj = lines.Lookup(lines.Keys[i]);
		//document.write(lObj.stops.length);
		// sort the stops (assuming the stop IDs increase along each line)
		lObj.stops.sort(sortNode);
		
		// remove duplicates (every other stop except the first and last stop)
		for (j=0; j<lObj.stops.length-1; j++) {
			if (lObj.stops[j+1] == lObj.stops[j]) {
				lObj.stops.splice(j, 1);
			}
		}
		// replace stop ID's with actual stop objects in lines.stops
		//var dummy;
		for (j=0; j<lObj.stops.length; j++) {
			sObj = Stops.Lookup(lObj.stops[j]);
//			if (!sObj.labeled) {
//				sObj.label = true;
//			}
//			else {
//				delete sObj.label;
//			}
			lObj.stops[j] = sObj;
		}
	}
}

// find the max and min x and y values for a dictionary of node objects
function maxMin(nodes) {
	var xmax = -1000000, ymax = -1000000, xmin = 1000000, ymin = 1000000, i, node;
	for (i=0; i<nodes.Keys.length; i++) {
		node = nodes.Lookup(nodes.Keys[i]);
		if (parseFloat(node.x) > xmax) {
			xmax = parseFloat(node.x);
		}
		if (parseFloat(node.y) > ymax) {
			ymax = parseFloat(node.y);
		}
		if (parseFloat(node.x) < xmin) {
			xmin = parseFloat(node.x);
		}
		if (parseFloat(node.y) < ymin) {
			ymin = parseFloat(node.y);
		}
	}
	//document.write([xmax, xmin, ymax, ymin].toString());
	return [xmax, xmin, ymax, ymin];
}


function normalizeCoords(nodes) {
	var xmax, xmin, ymax, ymin, ls=maxMin(nodes), i;
	xmax = ls[0];
	xmin = ls[1];
	ymax = ls[2];
	ymin = ls[3];
	for (i=0; i<nodes.Keys.length; i++) {
		node = nodes.Lookup(nodes.Keys[i]);
		node.x = ((parseFloat(node.x)-xmin)/(xmax-xmin)).toString();
		node.y = ((parseFloat(node.y)-ymin)/(ymax-ymin)).toString();
	}
	
}


function changeCoords(nodes, fcn) {
	fcn(nodes);
}

function contains(a, obj){
	  for(var i = 0; i < a.length; i++) {
	    if(a[i] === obj){
	      return true;
	    }
	  }
	  return false;
	}


// height and width should ideally be multiples of 40
function renderer(lines, col, row, cellsize, linewidth, cssText, legendID, grid) {
	// create div object for the map
	var map = document.getElementById("metromap");
	map.setAttribute("data-cellSize", cellsize.toString());
	map.setAttribute("data-columns", col.toString());
	map.setAttribute("data-row", row.toString());
	map.setAttribute("data-lineWidth", linewidth.toString());
	map.setAttribute("data-textClass", cssText);
	map.setAttribute("data-legendId", legendID);
	map.setAttribute("data-grid", grid);
	map.setAttribute("data-curve", "false");
	map.setAttribute("data-padding", "2");
	//map.setAttribute("style", "position:absolute; left:100px; top:100px;");
	
	var i, j, line, stop, coord, nodeType = "", text, lObj;
	for (i=0; i<lines.Keys.length; i++) {
		//document.write(lines.Keys.length +'\n');
		line = document.createElement("ul");
		lObj = lines.Lookup(lines.Keys[i]);
		line.setAttribute("data-color", lObj.color);
		line.setAttribute("data-label", lObj.name);
		//document.write("On line: " + lObj.name +': ');
		for (j=0; j<lObj.stops.length; j++) {
			//document.write(lObj.stops.length);
			stop = document.createElement("li");
			// get x, y coordinates based on col, row
			coord = [parseFloat(lObj.stops[j].x)*col, 
			         parseFloat(lObj.stops[j].y)*row];
			//document.write(lObj.stops[j].labeled + '\n');
			//document.write(j + '\n'+ lObj.stops[j].label + '; ');
			stop.setAttribute("data-coords", coord.toString());
			// Possible stop object attributes:
			// - x
			// - y
			// - name (title of article/node name)
			// - date
			// - mouseov
			// - landmark
			if (!lObj.stops[j].marked) {
				lObj.stops[j].marked = true;
				if (lObj.stops[j].landmark == 1 || lObj.stops[j].onLines.length > 1 || lObj.stops[j].offsets.Keys.length > 0) {
					nodeType = "interchange";
				} else if ((!lObj.stops[j].labeled) && (lObj.stops[j].dummy == '0')){
					nodeType = "station";
				} else {
					nodeType = "";
				}
				stop.setAttribute("data-marker", nodeType);
			}
			
			// label a node only if it hasn't been labeled in another line already
			if (!lObj.stops[j].labeled) {
				text = document.createTextNode(lObj.stops[j].label + "\n" + lObj.stops[j].date);
				lObj.stops[j].labeled = true;
			}
			else {
				text = document.createTextNode(" ");
			}
			
			//add offsets if applicable
			if (contains(lObj.stops[j].offsets.Keys, lines.Keys[i])){
				var offsetx, offsety;
				//document.write(lObj.stops[j].id);
				offsetx = lObj.stops[j].offsets.Lookup(lines.Keys[i])[0];
				offsety = lObj.stops[j].offsets.Lookup(lines.Keys[i])[1];
				stop.setAttribute("offset-x", offsetx.toString());
				stop.setAttribute("offset-y", offsety.toString());				
			}
			
			
			
			//interchange elongation for overlapping lines
			if (nodeType == "interchange" && lObj.stops[j].offsets.Keys.length > 0) {
				var start, STOP;
				//document.write(":" +lObj.stops[j].offsets.Keys + ":");
				start = lObj.stops[j].offsets.Lookup(lObj.stops[j].offsets.Keys[0]);
				var startPt = Math.atan((-start[0])/start[1]);
				stop.setAttribute("startPt", startPt.toString());
				
				STOP = lObj.stops[j].offsets.Lookup(lObj.stops[j].offsets.Keys[lObj.stops[j].offsets.Keys.length-1]);
				//document.write(start);
				stop.setAttribute("startX", start[0].toString());
				stop.setAttribute("startY", start[1].toString());
				stop.setAttribute("stopX", STOP[0].toString());
				stop.setAttribute("stopY", STOP[1].toString());
			
			}
			
			// do not mark over interchange markers
			if (!lObj.stops[j].marked) {
				stop.setAttribute("data-marker", nodeType);
				//document.write("!!" + nodeType +'\n' + lObj.stops[j].id+"!!");
			}
			
			if ("mouseov" in lObj.stops[j]) {
				var mo = document.createElement("a");
				mo.setAttribute("title", lObj.stops[j].mouseov);
				mo.appendChild(text);
				stop.appendChild(mo);
			} else {
				stop.appendChild(text);
			}
			line.appendChild(stop);
		}
		map.appendChild(line);
	}
}

function sortArticles(a, b) {
	var d1, d2;
	//d1 = parseDate(a);
	//d2 = parseDate(b):
	return d1-d2; // assuming date substraction works this way
}

//function parseDate(str) {
	// return a date object
//}

function articleList(lines, divElement) {
	var div = document.getElementByID(divElement);
	var articleList = new Array();
	var i;
	for (i=0; i<lines.Keys.length; i++) {
		var article = new Object();
		lObj = lines.Lookup(lines.Keys[i]);
		var j, Stop;
		for (j=0; j<lObj.stops.length; j++) {
			Stop = lObj.stops[j];
			article.date = Stop.date;
			article.title = Stop.label;
		}
	}
	
	// Sort articles based on date
	articleList.sort(sortArticles);

	// Separate articles into sublists by year
	
	// Add articles to div element
	
}


var xmlDoc;
var xmlloaded = false;

function importXML(xmlfile)
{
    try
    {
        var xmlhttp = new XMLHttpRequest();
        xmlhttp.open("GET", xmlfile, false);
    }
    catch (Exception)
    {
        var ie = (typeof window.ActiveXObject != 'undefined');

        if (ie)
        {
            xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
            xmlDoc.async = false;
            while(xmlDoc.readyState != 4) {};
            xmlDoc.load(xmlfile);
            readXML();
            xmlloaded = true;
        }
        else
        {
            xmlDoc = document.implementation.createDocument("", "", null);
            xmlDoc.onload = readXML;
            xmlDoc.load(xmlfile);
            xmlloaded = true;
        }
    }

    if (!xmlloaded)
    {
        xmlhttp.setRequestHeader('Content-Type', 'text/xml')
        xmlhttp.send("");
        xmlDoc = xmlhttp.responseXML;
        readXML();
        xmlloaded = true;
    }
}


function readXML() {
	var lines = parser(xmlDoc);
	var map = document.getElementById("metromap");
	var w = $('#metromap').width(), h = $('#metromap').height();
	//document.write(w);
	renderer(lines, Math.round(w/50)+3, Math.round(h/60), 40, 5, "text", "legend", "false");
	
	$(".map").subwayMap({ debug: true });
}
