//===========================================================================
//Provides a Dictionary object for client-side java scripts
//===========================================================================

function Lookup(key) {
	return(this[key]);
}

function cmp(a, b) {
    return a[1].localeCompare(b[1]);
}

function Delete() {
	for (c=0; c < Delete.arguments.length; c++) 
	{
 		this[Delete.arguments[c]] = null;
	}
	// Adjust the keys (not terribly efficient)
	var keys = new Array()
	for (var i=0; i<this.Keys.length; i++) {
	 	if(this[this.Keys[i]] != null) {
	   	keys[keys.length] = this.Keys[i];
	   }
	}
	this.Keys = keys;
}

function Add() {
	for (c=0; c < Add.arguments.length; c+=2) {
	 	// Add the property
	 	this[Add.arguments[c]] = Add.arguments[c+1];
	 	// And add it to the keys array
	 	this.Keys[this.Keys.length] = Add.arguments[c];
	}
}

function Dictionary() {
	this.Add = Add;
	this.Lookup = Lookup;
	this.Delete = Delete;
	this.Keys = new Array();
}

//============================================================================

// Takes an array of length 3 containing the RGB of a color and returns the hex
function colorToHex(color) {return "#"+toHex(color[0])+toHex(color[1])+toHex(color[2])}

// fix the 4096-character limit in firefox
function getNodeText(xmlNode)  
{  
        if(!xmlNode) return '';  
        if(typeof(xmlNode.textContent) != "undefined") return xmlNode.textContent;  
        return xmlNode.firstChild.nodeValue;  
}  
	


function toHex(n) {
	n = parseInt(n,10);
	if (isNaN(n)) return "00";
	n = Math.max(0,Math.min(n,255));
	return "0123456789abcdef".charAt((n-n%16)/16) + "0123456789abcdef".charAt(n%16);
}

//Parse the xml file to create javascript objects
function parser(xmlDoc) {
	var nodes = xmlDoc.getElementsByTagName("node");
	var edges = xmlDoc.getElementsByTagName("edge");
	var keys  = xmlDoc.getElementsByTagName("key");
	
	var lines = new Dictionary();
	var Stops = new Dictionary();
	var Edges = new Array();
	
	// create a dictionary of line objects with empty arrays to hold nodes
	// key = id
	var i, oneObject, x;
	for (i=0; i<keys.length; i++) {
		x = keys[i].attributes;
		if (x.getNamedItem("for").nodeValue == "edge") {
			oneObject = new Object();
			oneObject["id"] = x.getNamedItem("id").nodeValue;
			oneObject["name"] = x.getNamedItem("attr.name").nodeValue;
			var r = x.getNamedItem("color.r").nodeValue;
			var g = x.getNamedItem("color.g").nodeValue;
			var b = x.getNamedItem("color.b").nodeValue;
			oneObject["color"] = colorToHex([r,g,b]);
			oneObject["stops"] = new Array();
			oneObject["importance"] = x.getNamedItem("importance").nodeValue;
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
		
		stop = new Object();
		
		for (k=0; k<nodes[j].childNodes.length; k++) {
			z = nodes[j].childNodes[k];
			if (z.tagName == "data") {
				key = z.attributes[0].nodeValue;
				stop[key] = getNodeText(z); // z.childNodes[0].nodeValue; 
				stop.neighbors = new Array();
				stop.id = y.getNamedItem("id").nodeValue;
				// dictionary of offsets with line as key and (offx, offy) as values
				stop.offsets = new Dictionary();
				stop.onLines = new Array();
				stop.edges = new Array();

			}			
		}
		//stop.marked = false;
		//stop.labeled = false;
		Stops.Add(y.getNamedItem("id").nodeValue, stop);
	}
	
	// iterate through edges to populate lines with stops
	// add incident edges as properties to nodes
	var nodeInLines = new Array();
	var src, dst, line, x, srcObj, dstObj, numEdge, center, edge;
	for (i=0; i<edges.length; i++) {
		edge = new Object();
		src = edges[i].attributes.getNamedItem("source").nodeValue;
		dst = edges[i].attributes.getNamedItem("target").nodeValue;
		
		// add neighboring nodes as an attribute to stop objects
		srcObj = Stops.Lookup(src);
		dstObj = Stops.Lookup(dst);
		srcObj.neighbors[srcObj.neighbors.length] = dstObj;
		dstObj.neighbors[dstObj.neighbors.length] = srcObj;
		nodeInLines[nodeInLines.length] = srcObj;
		nodeInLines[nodeInLines.length] = dstObj;
		
		edge.source = srcObj;
		edge.destination = dstObj;
		edge.lines = new Array();
		
		srcObj.edges[srcObj.edges.length]=edge;
		dstObj.edges[dstObj.edges.length]=edge;
		
		
		numEdge = edges[i].getElementsByTagName("data").length;
		center = numEdge/2.0;
		//document.write(src + " , " + dst +'\n');
		var lineNum = 0;
		for (j=0; j<edges[i].childNodes.length; j++) {
			x = edges[i].childNodes[j];
			
			if (x.tagName == "data") {
				line = lines.Lookup(edges[i].childNodes[j].attributes[0].nodeValue);
				if (!contains(edge.lines, line)) {
					edge.lines[edge.lines.length] = line;
				}
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
				/*if (numEdge > 1) {
					
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
				}*/
				lineNum++;
 			}
		}
		
		Edges[Edges.length] = edge;
	}
	
	//Get rid of nodes not in lines
	var i;
	var toBeDeleted = new Array();
	for (i=0; i<Stops.Keys.length; i++) {
		var Node = Stops.Lookup(Stops.Keys[i]);
		if (!contains(nodeInLines, Node)) {
			toBeDeleted[toBeDeleted.length] = Node.id;
		}
	}
	for (i=0; i<toBeDeleted.length; i++) {
		Stops.Delete(toBeDeleted[i]);
	}
	
	changeCoords(Stops, normalizeCoords);
	
	// remove duplicate stops and put the stops in order
	orderStops(lines, Stops);
	
	//Edge offsets
	var k, l;
	for (k=0; k<Stops.Keys.length; k++) {
		var Node = Stops.Lookup(Stops.Keys[k]);
		if (Node.onLines.length == 1) {
			Node.offsets.Add(Node.onLines[0], [0, 0]);
		}
		else {
			//sort lines by ID
			Node.onLines.sort(sortLine);


			var central =(Node.onLines.length/2.0)-0.5;
			for (l=0; l<Node.onLines.length; l++) {
				//TODO:
				//respect any ordering set within a single edge
				//otherwise go by line ID
				
				//Offset by line ID for now
				
				//assign offsets (unit = lineWidth)
				Node.offsets.Add(Node.onLines[l], [0, l-central]);
			}
		}
	}
	
	
	
	return {
		'Nodes': Stops,
		'Edges': Edges,
		'Lines': lines
	};
}


function sortNode(a, b) {
	return parseInt(a.substring(1)) - parseInt(b.substring(1));
}

function sortLine(a, b) {
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
		if ((xmax-xmin) > 0) {
			node.x = ((parseFloat(node.x)-xmin)/(xmax-xmin)).toString();
		}
		if ((ymax - ymin) > 0) {
			node.y = ((parseFloat(node.y)-ymin)/(ymax-ymin)).toString();
		}
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

function interChange(slope, l, ctx, x, y, strokeWidth, edgeWidth) {
	//Black on white
	var fgColor = "#000000";
   var bgColor = "#ffffff";
   
   ctx.strokeStyle = fgColor;
   ctx.fillStyle = bgColor;
   
   ctx.lineWidth = strokeWidth;
   
   //Calculate new centers
   if (slope >= 0) {
   	var x1 = x+Math.sqrt(Math.pow(l/2.0, 2) / (1+Math.pow(slope, 2)));
   	var y1 = y+Math.sqrt(Math.pow(l/2.0, 2) - Math.pow(l/2.0, 2) / (1+Math.pow(slope, 2)));
   	var x2 = x-Math.sqrt(Math.pow(l/2.0, 2) / (1+Math.pow(slope, 2)));
   	var y2 = y-Math.sqrt(Math.pow(l/2.0, 2) - Math.pow(l/2.0, 2) / (1+Math.pow(slope, 2)));
   }
   else {
   	var x1 = x+Math.sqrt(Math.pow(l/2.0, 2) / (1+Math.pow(slope, 2)));
   	var y1 = y-Math.sqrt(Math.pow(l/2.0, 2) - Math.pow(l/2.0, 2) / (1+Math.pow(slope, 2)));
   	var x2 = x-Math.sqrt(Math.pow(l/2.0, 2) / (1+Math.pow(slope, 2)));
   	var y2 = y+Math.sqrt(Math.pow(l/2.0, 2) - Math.pow(l/2.0, 2) / (1+Math.pow(slope, 2)));
   }
   
   //Calculate start and end angles
   var normSlope = -1.0/slope;
   var startAngle = Math.atan(normSlope);
   var endAngle = Math.atan(normSlope) + Math.PI;

	ctx.beginPath();
	//angle in degree
	if (slope <= 0 ) {
		ctx.arc(x1, y1, edgeWidth*1.3, startAngle, endAngle, true);
		ctx.arc(x2, y2, edgeWidth*1.3, endAngle, startAngle, true);
	}
	else {
		ctx.arc(x2, y2, edgeWidth*1.3, endAngle, startAngle, false);
		ctx.arc(x1, y1, edgeWidth*1.3, startAngle, endAngle, false);
	}
	ctx.fill();
	ctx.closePath();
	ctx.stroke();
	
}

/*function drawNode(Node, ctx, strokeWidth, lineWidth) {
	if (Node.onLines.length == 1) { // Just a circle
		var fgColor = "#000000";
   	var bgColor = "#ffffff";
   
   	ctx.strokeStyle = fgColor;
   	ctx.fillStyle = bgColor;
   	ctx.lineWidth = strokeWidth;
   	ctx.beginPath();
		ctx.arc(Node.x, Node.y, lineWidth*1.1, 0, Math.PI*2, true);
		ctx.closePath();
		ctx.stroke();
	}
	else { //interchange
		interChange(1000000, Node.onLines.length*lineWidth, ctx, Node.x, Node.y, strokeWidth, lineWidth);
	}
}*/

function regNode(ctx, x, y, lineWidth, strokeWidth) {
	var fgColor = "#000000";
   var bgColor = "#ffffff";
   
   ctx.strokeStyle = fgColor;
   ctx.fillStyle = bgColor;
   
   ctx.lineWidth = strokeWidth;
   ctx.beginPath();
   ctx.arc(x, y, lineWidth*1.1, 0, Math.PI*2, true);
   ctx.fill();
   ctx.closePath();
   ctx.stroke();
	
}

function drawEdge(startX, startY, endX, endY, color, lineWidth, ctx) {
	ctx.strokeStyle = color;
	ctx.lineWidth = lineWidth;
	ctx.beginPath();
	ctx.moveTo(startX, startY);
	ctx.lineTo(endX, endY);
	ctx.closePath();
	ctx.stroke();
}

function edgeLen(edge) {
	var src = edge.source;
	var dst = edge.destination;
	return Math.sqrt(Math.pow(src.x-dst.x, 2) + Math.pow(src.y-dst.y, 2));
}

function addEventHandler(elem,eventType,handler) {
 if (elem.addEventListener) elem.addEventListener (eventType,handler,false);
 else if (elem.attachEvent) elem.attachEvent ('on'+eventType,handler); 
}

function render(Nodes, Edges, Lines, mapCanvas, drag, lineWidth, strokeWidth) {
	
	//Wrapper div used to contain canvas and nodes objects
	var wrapper = document.getElementById('drag');	
	wrapper.innerHTML = "<canvas id='mapCanvas'> </canvas>";
	
	// Set up canvas
	var mapCanvas = document.getElementById("mapCanvas");
	mapCanvas.innerHTML = "";
	var Mainctx = mapCanvas.getContext('2d');
	
	//Determine height and width of canvas to reinforce minimum edge length
	// Min edge length = 150 pixels
	var m;
	var edgeLengths = new Array();
	for (m=0; m<Edges.length; m++) {
		var Edge = Edges[m];
		edgeLengths[edgeLengths.length] = edgeLen(Edge);
	}
	var minLen = Math.min.apply(null, edgeLengths);
	var  width = parseInt(100/minLen);
	var  height= Lines.Keys.length*100;
	
	
	//Fix x and y coordinated based on new width and height
	var n;
	for (n=0; n<Nodes.Keys.length; n++) {
		var Node = Nodes.Lookup(Nodes.Keys[n]);
		Node.x = parseFloat(Node.x)*width+50;
		Node.y = parseFloat(Node.y)*height + 50;
	}
	
	mapCanvas.setAttribute("width", (width+100)+'');
	mapCanvas.setAttribute("height", (height+100)+'');
	
	//Draw edges
	var j, k;
	for (j=0; j<Edges.length; j++) {
		var Edge = Edges[j];
		for (k=0; k<Edge.lines.length; k++) {
			var line = Edge.lines[k];
			//document.write(line.id);
			var srcoff = Edge.source.offsets.Lookup(line.id);
			var dstoff = Edge.destination.offsets.Lookup(line.id);
			var startX = Edge.source.x + srcoff[0]*lineWidth;
			var startY = Edge.source.y + srcoff[1]*lineWidth;
			var endX = Edge.destination.x + dstoff[0]*lineWidth;
			var endY = Edge.destination.y + dstoff[1]*lineWidth;
			drawEdge(startX, startY, endX, endY, line.color, lineWidth, Mainctx);
		}
		
	}

	
	
	
	// Draw nodes, labels, and make modal windows
	var i;
	for (i=0; i<Nodes.Keys.length; i++) {
		var Node = Nodes.Lookup(Nodes.Keys[i]);
		if (Node.dummy=="0") { //Only render nodes that are not dummies
			//Create canvas for node
			var canvas = document.createElement("canvas");
			
			wrapper.appendChild(canvas);
			canvas.setAttribute("id", Node.id);
			//canvas.setAttribute("style", "border-style:solid; border-width:1px;"); // for debugging only
			//var ctx = canvas.getContext('2d');
			
			var l = (Node.onLines.length-1)*lineWidth;
			
			//Figure out position of canvas
			
			                      
			//$(canvas).offset({left: Node.x - lineWidth*1.3 - strokeWidth*1.2,
			//                      top:  Node.y - l/2.0 - lineWidth*1.3 - strokeWidth*1.2 - 20});
			
			
			// Figure out size of the canvas (to fit snugly around the node)
			canvas.height = l + 2*lineWidth*1.3 + 2*strokeWidth*1.2;
			canvas.width = 2*lineWidth*1.3 + 2*strokeWidth*1.2;
			
			//Draw node
			if (Node.onLines.length > 1) { //interchange
				//Figure out position of canvas
				$(canvas).offset({left: $("#drag").offset().left + Node.x - lineWidth*1.3 - strokeWidth*1.2,
			                      top:  $("#drag").offset().top  + Node.y - l/2.0 - lineWidth*1.3 - strokeWidth*1.2});
				canvas.height = l + 2*lineWidth*1.3 + 2*strokeWidth*1.2;
				canvas.width = 2*lineWidth*1.3 + 2*strokeWidth*1.2;
				interChange(1000000, l, Mainctx, Node.x, Node.y, strokeWidth*1.2, lineWidth);
			}
			else { // regular node
				//Figure out position of canvas
				$(canvas).offset({left: $("#drag").offset().left + Node.x - lineWidth*1.3 - strokeWidth*1.2,
			                      top:  $("#drag").offset().top  + Node.y - l/2.0 - lineWidth*1.3 - strokeWidth*1.2});
				canvas.height = 2*lineWidth*1.3 + 2*strokeWidth*1.2;
				canvas.width = 2*lineWidth*1.3 + 2*strokeWidth*1.2;
				regNode(Mainctx, Node.x, Node.y, lineWidth, strokeWidth);
			}

			//fix image URLs
			var txt = new String(Node.text);
			var p = /http\/\//g;
			
			
			Node.text = txt.replace(p, "http://");
			
			//create div for dialog box
			var dial = document.createElement("div");
			$('#modal_dial').append(dial);
			//alert(Node.label);
			dial.setAttribute("id", Node.id+"dial");
			dial.setAttribute("title", Node.label);
			dial.setAttribute("style", "display:none;");
			dial.innerHTML = Node.text;
			
			
			//create div for modal window
			var modal = document.createElement("div");
			$('#modal_dial').append(modal);
			modal.setAttribute("id", Node.id+"modal");
			modal.setAttribute("class", "reveal-modal");
			modal.innerHTML = "<h1>"+Node.label+"</h1>"+Node.text+"<a class='close-reveal-modal'>&#215;</a>";
			
			try {
				$('#'+Node.id+'dial').dialog({ autoOpen: false,  
			                                  resizable: false });
				
				// Mouse events
				$('#'+Node.id).click(function (e) { 
	      		$('#'+e.currentTarget.id+'dial').dialog('close');
	      		$('#'+e.currentTarget.id+'modal').reveal();
	    		});
	    		
	    		
	    		
	    		$('#'+Node.id).mouseenter(function (e) { 
	    			if ($(window).width()-e.pageX - 30 > 350) {
	      	   	$('#'+e.currentTarget.id+'dial').dialog({position: [e.pageX + 30, e.pageY - 30]});
	      	   }
	      	   else {
	      	   	$('#'+e.currentTarget.id+'dial').dialog({position: [e.pageX -30 - 350, e.pageY - 30]});
	      	   }
		  			$('#'+e.currentTarget.id+'dial').dialog('open');
	    		});
	    		
	    		$('#'+Node.id).mouseleave(function (e) { 
	      		$('#'+e.currentTarget.id+'dial').dialog('close');
	    		});
	    	}
	    	catch(err) {
	    		var txt ="Error description: " + err.description + "\n";
	    		txt += "Interactive components skipped.\n";
	    		txt += "Node ID: " + Node.id + '\n';
	    		if (window.console && window.console.log) {
            	window.console.log(txt);
            }
	    	}
    		

		}
		
	}
	
	//Text labels
	var el = $("#drag");
	var j, Node;
	for (j=0; j<Nodes.Keys.length; j++) {
		Node = Nodes.Lookup(Nodes.Keys[j]);
		
		var span = document.createElement("span");
		
		$(span).appendTo(el);
		
		var pos = "";
     	var offset = lineWidth + 4;
      var topOffset = 0;
      var centerOffset = "-50px";
      switch(Node.labelPos.toLowerCase()) {
            case "n":
            	 $(span).css("text-align", "center");
            	 $(span).css("margin", "0 0 " + offset + "px " + centerOffset);
                //pos = "text-align: center; margin: 0 0 " + offset + "px " + centerOffset;
                topOffset = offset * 2;
                break;
            case "w":
                $(span).css("text-align", "right");
                $(span).css("margin", "0 " + offset + "px 0 -" + (100 + offset) + "px");
                //pos = "text-align: right; margin:0 " + offset + "px 0 -" + (100 + offset) + "px";
                topOffset = offset;
                break;
            case "e":
            	 $(span).css("text-align", "left");
                $(span).css("margin", "0 0 0 " + offset + "px");
                //pos = "text-align: left; margin:0 0 0 " + offset + "px";
                topOffset = offset;
                break;
            case "s":
                $(span).css("text-align", "center");
                $(span).css("margin", offset + "px 0 0 " + centerOffset);
                //pos = "text-align: center; margin:" + offset + "px 0 0 " + centerOffset;
                break;
            case "se":
                $(span).css("text-align", "left");
                $(span).css("margin", offset + "px 0 0 " + offset + "px");
                //pos = "text-align: left; margin:" + offset + "px 0 0 " + offset + "px";
                break;
            case "ne":
                $(span).css("text-align", "left");
                $(span).css("padding-left", offset + "px");
                $(span).css("margin", "0 0 " + offset + "px 0");
                //pos = "text-align: left; padding-left: " + offset + "px; margin: 0 0 " + offset + "px 0";
                topOffset = offset * 2;
                break;
            case "sw": 
                $(span).css("text-align", "right");
                $(span).css("margin", "0 " + offset + "px 0 -" + (100 + offset) + "px");
                //pos = "text-align: right; margin:0 " + offset + "px 0 -" + (100 + offset) + "px";
                topOffset = offset;
                break;
            case "nw": 
                $(span).css("text-align", "right");
                $(span).css("margin", "0 " + offset + "px 0 -" + (100 + offset) + "px");
                //pos = "text-align: right; margin:0 " + offset + "px 0 -" + (100 + offset) + "px";
                topOffset = offset;
                break;
        }
        
        span.setAttribute("class", "textLabel");
        
        span.innerHTML = (j+1) + ". " + Node.label.replace(/\\n/g,"<br />") + "/<br>" + Node.date;
        
        $(span).offset({top: Node.y - $(span).height() +10  + el.offset().top - (topOffset > 0 ? topOffset : 0),
                        left: Node.x + el.offset().left - 50});
                        
        
        

        //var style = "top:" + (Node.y-140 - 8*parseInt(Node.label.length/10.0 - 2) + el.offset().top - (topOffset > 0 ? topOffset : 0)) + "px;left:" + (Node.x + el.offset().left) + "px;z-index:3000;'";
		
	}

	//Legend
	var legend = $("#legend");
	legend.html('');
	var i, Line;
	for (i=0; i<Lines; i++) {
		Line = Lines.Lookup(Lines.Keys[i]);
		legend.append("<center><div><span style='margin:3px;float:left;width:20px;height:" + lineWidth + "px;background-color:" + Line.color + "'></span>" + Line.name + "</div></center>");
	}
	
	//Article list
	
	var settings = {
	//	autoReinitialise: true,
	showArrows: true
	};
	var pane = $("#articleListBox"); //$('.sidebox');
				
				
	pane.jScrollPane(settings);
				
					
	var api = pane.data('jsp');
    api.getContentPane().html('');
	    //var arts = $("#articleListBox");
	
	    //arts.html('');
	var j, Node;
	
	var myDates=new Array(Nodes.Keys.length);
	
	
	for (j=0; j<Nodes.Keys.length; j++) {
		Node = Nodes.Lookup(Nodes.Keys[j]);
		//sort articles by dates
	    myDates[j]=[j, Node.id]; 
		//arts.append("<p>"+Node.label+"</p>");
	}
	
	myDates.sort(cmp);
	
	var prevYear="";
	var curYear="";
	var months=["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"];
	var curMonth;
	var intCurMonth;
	
	
	
	
    for (j=0; j<Nodes.Keys.length; j++) {
	    Node = Nodes.Lookup(Nodes.Keys[ myDates[j][0] ]);
	    curYear= Node.date.substring(0,4);
		if (curYear != prevYear)
		{
			//arts.append
			api.getContentPane().append("<p><center><font color=blue><b>"+ curYear + "</b></font><hr width=\"25%\" style=\"margin:0\"/></center></p>");
		}
		prevYear=curYear;
		curMonth= Node.date.substring(5,7);
		if (curMonth.substring(0,1)=="0")
		  curMonth= curMonth.substring(1);
		  
		intcurMonth= parseInt(curMonth)-1;
    	//arts.append
		api.getContentPane().append("<p><b>" + months[intcurMonth] + "  " + Node.date.substring(8) + " </b>" + Node.label+"</p>");
	}
	
	// update scroll bars

	api.reinitialise();
    api.scrollToY(0);
				
					
			
		
	
	
	
}