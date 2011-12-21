<?php
$q=$_GET["q"];
//$q = "eeee";

if (strlen($q) > 0) {
	// Call Dafna's C++ code to add entry into the database
	$keyword = hexdec($q); // TODO: figure out what to do with raw string input 
	exec("../../server/Dminion/dminion $keyword", $o, &$rv);
	
	if ($rv == 0) { // Successfully added the entry into the database
		// invoke twister in python with queryID to populate db with renderable xml
		exec("python lineImportance.py $keyword", &$output, &$status);
		
		if ($status == 0) { //Exited normally 
			// Retrieve renderable xml and pass it to javascript renderer
			//establish connection with db
			$mysql_id = mysql_connect('bigbrofs.ml.cmu.edu', 'dorx', 'nytis4dorx') or die('Could not connect: ' . mysql_error());
			mysql_select_db('nytimes', $mysql_id) or die('Could not select database');
			$query = "SELECT renderableXML FROM queryResults WHERE queryID=$keyword";
			$result = mysql_query($query) or die('Query failed: ' . mysql_error());
			$xml = mysql_fetch_row($result);
			
			header("content-type: text/xml");
			echo $xml[0];
			//$output = "../htdocs/xmlFromDB.graphml";
			//$fh = fopen($output, 'w');
			//fwrite($fh, $xml[0]);
			mysql_close($mysql_id);
		}
	}
}

?>