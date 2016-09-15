<?php

    /**
    * Database structure / administration page
    *
    * @package     Heurist academic knowledge management system
    * @link        http://HeuristNetwork.org
    * @copyright   (C) 2005-2016 University of Sydney
    * @author      Artem Osmakov   <artem.osmakov@sydney.edu.au>
    * @license     http://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
    * @version     4.0
    */

    define('LOGIN_REQUIRED',1);
    
    /*
    * Licensed under the GNU License, Version 3.0 (the "License"); you may not use this file except in compliance
    * with the License. You may obtain a copy of the License at http://www.gnu.org/licenses/gpl-3.0.txt
    * Unless required by applicable law or agreed to in writing, software distributed under the License is
    * distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied
    * See the License for the specific language governing permissions and limitations under the License.
    */
    require_once(dirname(__FILE__)."/initPage.php");
?>
        <script type="text/javascript" src="<?php echo PDIR;?>hclient/framecontent/databaseExport.js"></script>

        <script type="text/javascript">
            var editing;
            
            // Callback function on initialization
            function onPageInit(success){
                if(success){
                    
                    var databaseExport = new hDatabaseExport();
                    
                    var $container = $("<div>").appendTo($("body"));
                }
            }            
        </script>
    </head>
    <body style="background-color:white">
        <div style="width:280px;top:0;bottom:0;left:0;position:absolute;padding:5px;">
            <ul id="menu_container" style="margin-top:10px;padding:2px">
            
<li>EXPORT RESULTS SET</li>

<li class="admin-only" style="padding-left:5px;">
    <a href="export/delimited/exportDelimitedForRectype.html" name="auto-popup" class="fixed h3link"
        title="Export records as delimited text (comma/tab), applying record type and additional Heurist search filter as required">
        CSV</a>
</li>

<li id="menu-export-hml-0" style="padding-left:5px;">
    <a href="#"
        title="Generate HML (Heurist XML format) for current set of search results (current query + expansion)">
        HML</a>
</li>

<li id="menu-export-kml" style="padding-left:5px;">
    <a href="#"
        title="Generate KML for current set of search results (current query + expansion)">
        KML</a>
</li>

<li  id="menu-export-rss" style="padding-left:5px;">
    <a href="#"
        title="Generate RSS feed for current set of search results (current query + expansion)">
        RSS</a>
</li>

<li  id="menu-export-atom" style="padding-left:5px;">
    <a href="#"
        title="Generate Atom feed current set of search results (currrent query + expansion)">
        Atom</a>
</li>


<hr/>

<li>HML</li>


<li id="menu-export-hml-1" style="padding-left:5px;">
    <a href="#"
        title="Generate HML (Heurist XML format) for current selection">
        Selected records</a>
</li>

<li id="menu-export-hml-2" style="padding-left:5px;">
    <a href="#"
        title="Generate HML (Heurist XML format) for current selection and related records">
        Selected with related records</a>
</li>

<li id="menu-export-hml-3" style="padding-left:5px;">
    <a href="#"
        title="Generate HML (Heurist XML format) for current set of search results (current query) with one record per file, plus manifest">
        One file per record</a>
</li>

<hr/>

<li>ARCHIVE</li>

<li class="admin-only" style="padding-left:5px;"><a href="export/dbbackup/exportMyDataPopup.php" name="auto-popup" class="portrait h3link"
    title="Writes all the data in the database as SQL and XML files, plus all attached files, schema and documentation, to a ZIP file which you can download from a hyperlink">
    Complete data package</a>
</li>
            
            </ul>
        </div>
    </body>
</html>