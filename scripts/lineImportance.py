from xml.dom.minidom import parse, parseString
from datetime import datetime, timedelta
from math import acos, sqrt, pi
from random import choice
from sqlalchemy import *
from BeautifulSoup import BeautifulSoup
import sys, os, copy
from sqlalchemy.orm import sessionmaker, mapper

# dummy class for sqlalchemy
class QueryResults(object):
    pass

# First line in the middle of the page (0.5/1)
# x-coordinate = date
# y-coordinate = importance of the line

class Node:
    def __init__(self, name, x, y, dummy, date, domNode, title, text):
        """
        Attributes:
        self.name
        self.x
        self.y
        self.dummy: boolean indicating whether the node is a dummy node that doesn't have article contents
        self.date: The date obtained from db (format = Y-m-d); may change when doing x-coord assignment
        self.realDate: The date obtained from db (format = Y-m-d); never changes
        self.domNode: Node object in the DOM
        self.title
        self.text: Retrieved from the db
        self.inLines: List of line objects to which the node belongs
        self.inEdges: List of edge objects to which the node belongs
        self.inChunk: The chunk object to which the node belongs
        self.labelPos: Position of text label

        Note: Each node belongs to one and only one chunk
        """
        self.name = name
        self.x = x
        self.y = y
        self.dummy = dummy
        self.date = date
        self.realDate = date
        self.domNode = domNode
        self.title = title
        self.text = self.checkText(text)
        self.inLines = set()
        self.inEdges = set()
        self.inChunk = None
        self.labelPos = "n"

    def checkText(self, text):
        tree = BeautifulSoup(text)
        good = tree.prettify()
        return good

    def validY(self):
        """
        Check if the node has a valid y coordinate
        Nodes are initialized with y = -1
        """
        return 0<= self.y <= 1

    def firstLine(self, line):
        """Check if a line is the topmost line passing through the node"""
        for l in self.inLines:
            if type(line).__name__ == "float" or type(line).__name__ == "int":
                comp = line
            else:
                comp = line.y
            if l.y > comp:
                return False
        return True
        
class Edge:
    def __init__(self, n1, n2):
        """
        Attributes:
        self.src: Node object for the source
        self.dst: Node object for the destination
        """
        self.src = n1
        self.dst = n2

    def vec(self):
        """ Vector representation of the edge"""
        return [self.dst.x-self.src.x, self.dst.y-self.src.y]
    
    def length(self):
        """Length of the vector (with the x and y coords normalized)"""
        return sqrt((self.src.x-self.dst.x)**2 + (self.src.y-self.dst.y)**2)

class Chunk:
    def __init__(self, ls, line, determined=False, y=-1):
        """
        Attributes:
        self.inLine: The line object to which the chunk belongs
        self.ls: List of nodes contained in the chunk
        self.determined: Boolean indicating if the y coordinate of the chunk has been determined
        self.y

        Note: All nodes in the same chunk has the same y-coordinate
        """
        self.inLine = line
        self.ls = ls 
        self.determined = determined 
        self.y = y

        if self.y != -1: # In case inconsistent argument is passed into the constructor
            self.determined = True

    def toNode(self):
        """Instantiate the inChunk field of all nodes in the chunk"""
        for node in self.ls:
            node.inChunk = self

    def check(self):
        """
        Check if any node in the chunk has a valid y-coordinate
        If so, make all other nodes in the chunk have the same y-coordinate and return True
        Otherwise, return False
        """
        d = -1
        for node in self.ls:
            if node.validY():
                d = node.y
        if d != -1:
            for node in self.ls:
                node.y = d
            self.determined = True
            self.y = d
        return self.determined

    def setY(self, y):
        """ Set the chunk y value and the y-coordinate of all nodes in chunk """
        if 0 <= y <= 1:
            self.y = y
            for node in self.ls:
                node.y = y
            self.determined = True
        else:
            print "setY: invalid y passed in."

    def toggleY(self):
        """ Toggle the y-coordinate of the entire chunk (pos to neg and vice versa)"""
        if self.y == self.inLine.getPosY():
            self.setY(self.inLine.getNegY())
        elif self.y == self.inLine.getNegY():
            self.setY(self.inLine.getPosY())
        else:
            print "toggleY: y has not been initialized"

class Line:
    def __init__(self, name, y):
        """
        Attributes:
        self.name: attr.name for line from xml file
        self.y: y-coordinate in the postive direction based on line importance
        self.nodes: List of Node objects
        self.edges: List of Edge objects
        self.chunks: List of Chunk objects
        self.bends: Number of bends in the line
        """
        self.name = name
        self.y = y
        self.nodes = []
        self.edges = []
        self.chunks = []
        self.bends = 0

    def getPosY(self):
        """ Get the y-coordinate in the positive direction (above the main line) """
        return self.y

    def getNegY(self):
        """ Get the y-coordinate in the negative direction (under the main line) """
        return 0.5 - (self.y - 0.5)

    def orderNodes(self):
        """
        Order nodes in the line based on their ID's
        Assuming nodes with lower ID's always come before nodes with higher ID's        
        """
        
        # remove redundant nodes
        self.nodes = list(set(self.nodes))
        # order nodes in increasing order of ID
        self.nodes.sort(key=lambda node : int(node.name[1:]))

##        print "*****Original******"
##        print self.name
##        for node in self.nodes:
##            print node.date
##        print "*******************"

##        # Deal with nodes that have the same dates        
##        p = self.nodes[0]
##        for node in self.nodes[1:]:
##            if node.date < p.date or (node.date-p.date).days < 20:
##                # minimum edge length = 5 days
##                node.date = p.date + timedelta(20)
##            p = node
            
##        print "*****"
##        print self.name
##        for node in self.nodes:
##            print node.date
##        print "*****"

    def nodeSubList(self, node):
        """ Return the sublist of nodes from node to the end of the line """
        i = 0
        for n in self.nodes:
            if n == node:
                return self.nodes[i:]
            i += 1
        print "Node not found in list!"
        return None

    def orderEdges(self):
        """ Order edges in the line based on the ID of the source node of each edge """
        self.edges.sort(key=lambda Edge : int(Edge.src.name[1:]))

    def getChunks(self):
        """
        Break up the nodes in the line into chunks
        A chunk is a continuous run of nodes that does not contain a node that also
        belongs to a more important line. Not every node belongs to a chunk.
        """
        chunk = []
        for node in self.nodes:
            #print node.name
            #print len(node.inLines)
            if len(node.inLines)==1 or node.firstLine(self.y):
                #print "!!"+ node.name
                chunk.append(node)
            else:
                if chunk:
                    #print chunk
                    self.chunks.append(Chunk(chunk, self))
                    #print type(self)
                    chunk = []
        if chunk:
            self.chunks.append(Chunk(chunk, self))
        #print "Line at " + str(self.y)+" has chunks:"
        #print self.chunks

    def countBends(self):
        """ Return the number of bends in the line """
        c = 0
        prev = self.nodes[0].y
        for node in self.nodes[1:]:
            if prev == -1:
                print "countBends: y coordinates of some nodes in line not initialized yet."
                break
            if node.y != prev:
                c += 1
            prev = node.y
        return c

    def bendScore(self):
        """
        Return the 'bend score' for the line based on the number of bends and the bend angles.
        Acute angles are punished more(result in higher scores) than obtuse one.
        """
        s = 0
        for i in xrange(len(self.edges)-1):
            if ((not self.edges[i+1].src.validY()) or (not self.edges[i+1].dst.validY())):
                break
            angle = 2.0*pi*self.bendAngle(self.edges[i], self.edges[i+1])
            print "angle: " + str(angle)
            if angle > 180:
                angle -= 180
            # "punish" acute bends
            s += (180.0-angle)/180.0
        print "bendScore = " + str(s)
        return s
                        

    def bendAngle(self, e1, e2):
        """ Find the angle between two edges"""
        #print "bendAngle"
        d = sqrt(self.dot(e1.vec(), e1.vec())*self.dot(e2.vec(), e2.vec()))
        if d == 0:
            cos = 1.0
        else:
            cos = self.dot(e1.vec(), e2.vec()) / d
        print min([1, cos])
        print acos(max([-1,min([1, cos])]))
        return acos(max([-1,min([1, cos])]))

    def dot(self, A, B):
        """ Return the dot product of two vectors """
        s = 0.0
        for i in xrange(len(A)):
            s += A[i]*B[i]
        return s

    def getNextNode(self, node):
        """
        Return the node after 'node' in the line.
        Return None if the node isn't found in the line or the node is the last one in the line.
        """
        i = 0
        for n in self.nodes:
            if n == node and i != len(self.nodes)-1:
                return self.nodes[i+1]
            i += 1
        return None
            
    def getPrevNode(self, node):
        """
        Return the node before 'node' in the line.
        Return None if the node isn't found in the line or the node is the first one in the line.
        """
        i = 0
        for n in self.nodes:
            if n == node and i != 0:
                print n.name
                return self.nodes[i-1]
            i += 1
        return None
            
    def getPrevChunk(self, chunk):
        """
        Return the chunk before 'chunk' in the line.
        Return None if the chunk isn't found in the line or the chunk is the first one in the line.
        """
        i = 0
        for c in self.chunks:
            if c == chunk and i != 0:
                return self.chunks[i-1]
            i += 1
        return None
                        
class Graph:
    def __init__(self, nodes=[], edges=[], lines=[]):
        """
        Attributes:
        self.nodes
        self.edges
        self.lines
        self.edgePairs: Pairs of edges that intersect
        """
        self.nodes = nodes
        self.edges = edges
        self.lines = lines
        self.edgePairs = []

    def countCrossings(self):
        """
        Count the number of edge crossings in the graph.
        Note that pairs of edges that share a node are not considered intersecting.
        """
        if self.edges == []:
            return 0
        c = 0
        for i in xrange(len(self.edges)):
            for j in xrange(i):
                if self.intersect(self.edges[i], self.edges[j]):
                    self.edgePairs.append([self.edges[i], self.edges[j]])
                    c += 1
        return c

    def ccw(self, A,B,C):
        """ Auxillary method for determining line intersect"""
        return (C.y-A.y)*(B.x-A.x) > (B.y-A.y)*(C.x-A.x)

    def intersect(self, e1, e2):
        """
        Determine if two edges intersect.
        Edges that share a node are not considered intersecting.
        """
        A = e1.src
        B = e1.dst
        C = e2.src
        D = e2.dst
        if A == C or A == D or B == C or B == D:
            return False
        else:
            return self.ccw(A,C,D) != self.ccw(B,C,D) and self.ccw(A,B,C) != self.ccw(A,B,D)

    def getLinesScore(self):
        """ Get the sum of bend scores over all lines in the graph."""
        s = 0
        for line in self.lines:
            bs = line.bendScore()
            s += bs
        return s

    def XCoord(self):
        """
        Assign x-coordinates for nodes in the graph to enforce minimum edge length
        (10% of total width of the map).
        """

        # Deal with dummy nodes that do not have dates
        # Assume that a line never starts with a dummy node
        for l in self.lines:
            k = 0
            for n in l.nodes:
                left = k-1
                while (not n.date) and (left >= 0):
                    print "Fixing date of a dummy node"
                    # Check neighbor to the left
                    if l.nodes[left].date:
                        n.date = copy.deepcopy(l.nodes[left].date)
                    left -= 1;

                k += 1

        # Adjust dates
        dates = [node.date for node in self.nodes]
        #print dates
        Max = max(dates)
        Min = min(dates)
        minLength = int(0.1*((Max-Min).days))

        for line in self.lines:
            # Lines are already sorted with the most important line being the first
            p = line.nodes[0]
            for node in line.nodes[1:]:
                if node.date < p.date or (node.date-p.date).days < minLength:
                    node.date = p.date + timedelta(minLength)
                p = node

        # Reassign x-coordinates based on dates
        newDates = [node.date for node in self.nodes]
        newMax = max(newDates)
        newMin = min(newDates)
        tot = float((newMax - newMin).days)
        for node in self.nodes:
            node.x = float((node.date - newMin).days)/tot

        # Make sure that nodes with later dates never have a smaller x-coord than
        # nodes with earlier dates

        if minLength == 0:
            inc = 1.0/(tot+1.0)
        else:
            inc = float(minLength)/tot
        print "inc = "+ str(inc)
        self.nodes.sort(key=lambda Node: Node.realDate)
        prev = self.nodes[0]
        for node in self.nodes[1:]:
            if node.x <= prev.x:
                node.x = prev.x + inc
            prev = node

class Twister:
    def __init__(self, filename, output=None):
        """
        Attributes:
        self.dbConn: connection to the database
        self.dom: DOM object obtained from the XML string/file
        self.output: Location of output XML file; write resulting XML string to db if output=None
        self.lineDict: A dictionary of line objects with line IDs as the keys (e.g. 'l0')
        self.lines
        self.nodeDict: A dictionary of node objects with node ID as keys (e.g. 'n12345')
        self.nodes
        self.edges
        self.graph
        self.engine: engine for sqlalchemy
        self.session: session for sqlalchemy
        self.metadata: metadata for sqlalchemy
        self.dbConn: database connection (via sqlalchemy) to nytimes
        self.queryID: queryID parsed from the command line input
        """
        self.queryID = None
        engine = create_engine("mysql://dorx:nytis4dorx@bigbrofs.ml.cmu.edu/nytimes")
        self.engine = engine
        Session = sessionmaker()
        Session.configure(bind=engine)
        self.session = Session()
        metadata = MetaData(engine)
        self.metadata = metadata
        self.dbConn = engine.connect()
        if os.path.isfile(filename):
            self.dom = parse(filename)
        else:
            try:
                self.dom = parseString(filename)
            except:
                ## otherwise assume filename is a queryID and fetch xml from db
                self.queryID = str(filename)
                results = list(self.dbConn.execute("select resultxml from queryResults where queryID="+str(filename)))

                if results == []:
                    print "Invalid queryID! No results returned."
                    sys.exit(1)
                    
                ## Take the first xml string from all the strings returned (assuming they are the same)
                xmlString = results[0]["resultxml"]

                print "================  xmlString  ================"
                print xmlString
                print "============================================="

                try:
                    self.dom = parseString(xmlString)
                except:
                    print "Unable to parse xmlString obtained from database!"
                    sys.exit(1)

        self.output = output # Deal with output=None at writeXML
        print "xml DOM obtained"
        self.lineDict = self.lineCoord(self.dom)
        self.lines = self.lineDict.values()
        self.sortLines()
        print "lines obtained"
        self.nodeDict = self.getNodes(self.dom)
        self.nodes = self.nodeDict.values()
        print "nodes obtained"
        self.edges = self.nodeToLine(self.dom, self.lineDict, self.nodeDict)
        for line in self.lines:
            line.getChunks()
        print "edges obtained"
        self.graph = Graph(self.nodes, self.edges, self.lines)
        self.graph.XCoord()
        print "graph obtained"
        

    def lineCoord(self, dom):
        """
        Naive y-coordinate assignment based on line importance
        The most important line has y-coord 0.5 (center of the canvas)
        All y-coords are in the "positive" direction, i.e. above the central line
        """
        lines = []
        for key in dom.getElementsByTagName("key"):
            if key.attributes.getNamedItem("for").nodeValue == "edge":
                line = [float(key.attributes.getNamedItem("importance").nodeValue), key.attributes.getNamedItem("id").nodeValue]
                lines.append(line)
        lines.sort(reverse=True)
        Dict = {}
        y = 0.5
        i = 0
        for line in lines:
            Dict[line[1]] = Line(line[1], y-i*(y/len(lines)))
            i += 1
        return Dict #key = line name; value = Line object

    def getNodes(self, dom):
        """
        Create Node objects from the nodes in the DOM
        Retrieve info relevant to each node from the db based on node id
        """
        nodes = dom.getElementsByTagName("node")
        Nodes = {}
        for node in nodes:
            ID = node.attributes.getNamedItem("id").nodeValue

            # Get dummy
            dummy = False
            for a in node.childNodes:
                if a.nodeName == "data":
                    if a.attributes.getNamedItem("key").nodeValue == "dummy":
                        if int(a.childNodes[0].nodeValue) == 1:
                            dummy = True
                        

            if not dummy:
                query = 'select * from docs where docID='+ID[1:]
                result = self.dbConn.execute(query)
                ls = list(result)
                if len(ls)==0:
                    print "Article with ID = %s was not found in the database!" % (ID[1:])
                    sys.exit(1)

                entry = ls[0]
                date = entry['date']
                Nodes[ID] = Node(ID, 0, -1, dummy, date, node, entry['title'], entry['text'])

            else:
                # Initialize Node without information for date, title, and text
                Nodes[ID] = Node(ID, 0, -1, dummy, None, node, None, None)

##            for a in node.childNodes:
##                if a.nodeName == "data":
##                    # Collect all attributes into attrs
##                    attrs[a.attributes.getNamedItem("key").nodeValue] =  a.childNodes[0].nodeValue
##                    #if a.attributes.getNamedItem("key").nodeValue == "date":
##                    #    dates[ID] = datetime.strptime(a.childNodes[0].nodeValue, "%Y-%m-%d")
##        
##        # Look for "docID" in attributes to find row in database
##        if "docID" in attrs:
##            query = "select * from docs where docID="+str(attrs["docID"])
##        else: # If not present, use "label" instead
##            qeury = "select * from docs where title="+str(attrs["label"])
##        
##        Max = max(dates.values())
##        Min = min(dates.values())
##        tot = (Max - Min).days
##        coords = {}
##
##        # Assign x-coords(normalized) based on date
##        print dates.values()
##        for node in dates.keys():
##            xcoord = float((dates[node] - Min).days) / float(tot)
##            coords[node] = Node(node, xcoord, -1, dates[node]) # -1 as placeholder for y-coord
##        return coords

        return Nodes

    def nodeToLine(self, dom, lines, coords):
        """
        Parse the edge portion of the xml, populate lines with nodes and create edge objects
        """
        edges = dom.getElementsByTagName("edge")
        Edges = []
        for edge in edges:
            srcName = edge.attributes.getNamedItem("source").nodeValue
            dstName = edge.attributes.getNamedItem("target").nodeValue
            srcNode = coords[srcName]
            dstNode = coords[dstName]
            for a in edge.childNodes:
                if a.nodeName == "data":
                    lineName = a.attributes.getNamedItem("key").nodeValue
                    line = lines[lineName]
                    line.nodes.append(srcNode)
                    line.nodes.append(dstNode)
                    line.edges.append(Edge(srcNode, dstNode))
                    srcNode.inLines.add(line)
                    dstNode.inLines.add(line)
                    srcNode.inEdges.add(Edge(srcNode, dstNode))
                    dstNode.inEdges.add(Edge(srcNode, dstNode))
                    Edges.append(Edge(srcNode, dstNode))
        for line in lines.values():
            line.orderNodes()
            line.orderEdges()
        return Edges

    def sortLines(self):
        """ Sort all lines in the graph based on importance (most important first)"""
        self.lines.sort(key=lambda Line: Line.y, reverse=True)

    def yCoord(self):
        """Assign y-coordinates to nodes based on simple heuristics (first pass)"""
        for line in self.lines:
            print line.y
            if line.y == 0.5:
                # First line always at the center
                for node in line.nodes:
                    node.y = 0.5
            else:                        
                for chunk in line.chunks:
                    chunk.toNode()
                    if not chunk.check():
                        if chunk.ls[0] == line.nodes[0]:
                            # If the first node in first chunk is the first node in the line,
                            # put it in the positive direction
                            chunk.setY(line.getPosY())
                        else:
                            # Assign y-coordinate based on the position of the previous chunk/node
                            # If the previous node belongs to the central line and
                            # the chunk is not the first in the line, place it opposite the previous chunk;
                            # otherwise, place chunk in the positive position
                            prevNode = line.getPrevNode(chunk.ls[0])
                            #print prevNode
                            if prevNode.y == 0.5:
                                # Opposite of previous chunk
                                prevChunk = line.getPrevChunk(chunk)
                                #print "prevChunk.ls:"
                                #print prevChunk.ls
                                if prevChunk != None and prevChunk.y == line.y:
                                    chunk.setY(line.getNegY())
                                else:
                                    chunk.setY(line.getPosY())
                            else:
                                chunk.setY(line.getPosY())
            print "### Nodes missed during first pass ###"
            for node in line.nodes:
                if not node.validY():
                    print node.name
                    node.y = line.getPosY()
            print "######################################"

    def twist(self):
        """
        Find the best configuration that minimizes edge crossings and acute bends in lines
        by moving all the chunks in the graph around.
        """
        c = self.graph.countCrossings()
        # Note that c does not count edges that share terminal points
        if c == 0:
            return 

        movableChunks = set() # Consider all chunks not in the central line in the graph movable
##        for pair in self.graph.edgePairs:
##            e1 = pair[0]
##            e2 = pair[1]
##            if e1.src.y != 0.5:
##                movableChunks.add(e1.src.inChunk)
##            if e1.dst.y != 0.5:
##                #print e1.dst.date
##                movableChunks.add(e1.dst.inChunk)
##            if e2.src.y != 0.5:
##                #print e2.src.date
##                movableChunks.add(e2.src.inChunk)
##            if e2.dst.y != 0.5:
##                #print e2.dst.date
##                movableChunks.add(e2.dst.inChunk)
        configs = {}

        # Consider all chunks not in the central line in the graph movable
        for line in self.lines:
            for chunk in line.chunks:
                if chunk.y != 0.5 and chunk.y != -1:
                    movableChunks.add(chunk)
                    
        print "len(movableChunks) = " + str(len(movableChunks))
        totalUniqueConfigs = 2**len(movableChunks)
        uniqueConfigs = []

        # Find configurations that minimize crossings
        while len(configs.keys()) < totalUniqueConfigs:
            config = []
            for chunk in movableChunks:
                # Get line bendscore
                line = chunk.inLine
                s = line.bendScore
                # Toggle chunk position w/ prob 0.5
                if choice([0,1]) == 1:
                    chunk.toggleY()
                config.append(chunk.y)
            print config
            if not config in uniqueConfigs:
                uniqueConfigs.append(config)
                c = self.graph.countCrossings()
                configs[uniqueConfigs.index(config)] = c
        validConfigs = []
        print uniqueConfigs
        for config in configs:
            if configs[config] == min(configs.values()):
                validConfigs.append(config)
        print "# validConfigs: " + str(len(validConfigs))

        if len(validConfigs) > 1:
            # Find the configuration that minimizes bends and also bendscores:
            minScore = 10000000
            bestConfig = None
            for config in validConfigs: # config here is an index
                i = 0
                for chunk in movableChunks:
                    chunk.setY(uniqueConfigs[config][i])
                    i += 1
                s = self.graph.getLinesScore()
                if s < minScore:
                    minScore = s
                    bestConfig = config
        else:
            bestConfig = validConfigs[0] # the first and only valid config

        j = 0
        for chunk in movableChunks:
            chunk.setY(uniqueConfigs[bestConfig][j])
            j += 1

        minScore = self.graph.getLinesScore()

        print "done twisting"
        print "final number of edge crossings: " + str(min(configs.values()))
        print "final bend score: " + str(minScore)

##        print "Dates:"
##        for node in set(self.nodes):
##            print node.date
##
##        print "Edge lengths:"
##        for edge in self.edges:
##            print edge.length()

    def setAttribute(self, attr, elem, newVal):
        done = False
        for child in elem.childNodes:
            if child.nodeName == "data":
                if child.attributes.getNamedItem("key").nodeValue == attr:
                    child.firstChild.replaceWholeText(str(newVal))
                    done = True
        if not done:
            # Add attribute to the node element
            # <data key="x">1.375</data>
            a = self.dom.createElement("data")
            value = self.dom.createTextNode(str(newVal))
            a.appendChild(value)
            a.setAttribute("key", attr)
            elem.appendChild(a)
            
    
    def updateDom(self):
        """
        Update the DOM representing the XML with information about
        the position and content of each node
        """
        for node in self.nodes:
            # x
            self.setAttribute("x", node.domNode, node.x)
                
            # y
            self.setAttribute("y", node.domNode, node.y)
            
            # date
            self.setAttribute("date", node.domNode, node.realDate)
            
            # label
            self.setAttribute("label", node.domNode, node.title)
            
            # text
            self.setAttribute("text", node.domNode, node.text)

            # labelPos
            self.setAttribute("labelPos", node.domNode, node.labelPos)

        print "Done updating dom"
            
##            domNode = self.domNodeDict[node.name]
##            for child in domNode.childNodes:
##                if child.nodeName == "data":
##                    if child.attributes.getNamedItem("key").nodeValue == "x":
##                        child.firstChild.replaceWholeText(str(node.x))
##                    elif child.attributes.getNamedItem("key").nodeValue == "y":
##                        child.firstChild.replaceWholeText(str(node.y))

    def writeXml(self):
        """
        Write xml to output file or to database if no output file was given
        """
        if self.output:
            h = open(self.output, 'w')
            self.dom.writexml(h)
            print "xml written to file"
        else:
            # Write to db
            print "Writing the following string to the db..."
            xmlString = self.dom.toxml()
            #print self.dom.toprettyxml()
            print self.dom.toxml()
            ##instr = "update queryResults set renderableXML='"+xmlString+"' where queryID="+self.queryID+';'
            ##self.dbConn.execute(instr) # Simultaneously update all rows with the same queryID
            queryResults = Table('queryResults', self.metadata, autoload=True)
            resultMapper = mapper(QueryResults, queryResults, primary_key=[queryResults.c.queryID])
            row = self.session.query(QueryResults).filter(queryResults.c.queryID==int(self.queryID)).first()
            row.renderableXML = xmlString
            self.session.flush()
            print "Renderable XML written to database."


if __name__ == "__main__":
    if len(sys.argv) == 2:
        xmlString = sys.argv[1]
        outFile = None
        t = Twister(xmlString, outFile)
    elif len(sys.argv) == 3:
        inFile = sys.argv[1]
        outFile = sys.argv[2]
        t = Twister(inFile, outFile)
        
    print "done initializing"
    t.yCoord()
    t.twist()
    print "done twisting"
    t.updateDom()
    t.writeXml()                    
                    

                        
