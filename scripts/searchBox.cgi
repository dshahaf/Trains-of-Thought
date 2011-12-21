#!C:\Python27\python.exe -u
#!/usr/bin/env python#!/usr/bin/python

import cgi, os, sys, socket, cgitb
from sqlalchemy import *
from lineImportance import *

def generateHTML():
    # Get HTML template
    # 

## Enable debugging
cgitb.enable()

## Connect to database via SqlAlchemy
engine = create_engine("mysql://dorx:nytis4dorx@bigbrofs.ml.cmu.edu/nytimes")
connection = engine.connect()

## To execute commands, do connection.execute(command)

form = cgi.FieldStorage()
topic = form["topic"].value

## Query database to find appropriate xml file specifying basic topology
## TODO
## Placeholder code that searches for existing xml files
if sys.platform == "linux2" and socket.gethostname() == "turing":
    basedir = "/media/6AEE9E15EE9DD9A1/Users/dorx/workspace/xml2map"
elif "win" in sys.platform:
    basedir = "C:/Users/dorx/workspace/xml2map"
else:
    sys.exit("Cannot find a directory with the appropriate xml file.")
    
topoXML = None # The xml file containing the basic topological information
for fileName in os.listdir(basedir):
    if os.path.isfile(fileName):
        stem = fileName.split(".")[0]
        if topic == stem:
            topoXML = fileName

if topoXML: # If xml file found
    # Check if there's already an xml file containing the renderable map
    stem = topoXML.split('.')[0]+"_v2.graphml"
    inFile = os.path.join(basedir, topoXML)
    outFile = os.path.join(basedir, stem)
    if os.path.isfile(outFile): # Renderable xml exists
        # TODO
    else:
        # Use Twister to generate the renderable xml file
        twister = Twister(inFile, outFile)
        twister.yCoord() # Calculate the y-coordinates based on line importance
        twister.updateDom()
        t.writeXml() # Write updated xml file to outFile

else:
    # TODO
    
