<?php

    /**
    * Returns content of shp+dbf files as geojson or wkt output
    * 
    * @package     Heurist academic knowledge management system
    * @link        http://HeuristNetwork.org
    * @copyright   (C) 2005-2019 University of Sydney
    * @author      Artem Osmakov   <artem.osmakov@sydney.edu.au>
    * @license     http://www.gnu.org/licenses/gpl-3.0.txt GNU License 3.0
    * @version     4.0
    */

    /*
    * Licensed under the GNU License, Version 3.0 (the "License"); you may not use this file except in compliance
    * with the License. You may obtain a copy of the License at http://www.gnu.org/licenses/gpl-3.0.txt
    * Unless required by applicable law or agreed to in writing, software distributed under the License is
    * distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied
    * See the License for the specific language governing permissions and limitations under the License.
    */

    require_once (dirname(__FILE__).'/../System.php');
    require_once (dirname(__FILE__).'/../dbaccess/db_recsearch.php');
    require_once (dirname(__FILE__).'/../dbaccess/utils_db.php');
    require_once (dirname(__FILE__).'/../../viewers/map/Simplify.php');
    //require_once (dirname(__FILE__).'/../../vendor/autoload.php'); //for ShapeFile
    
// Register autoloader
require_once('../../vendor/gasparesganga/php-shapefile/src/Shapefile/ShapefileAutoloader.php');
Shapefile\ShapefileAutoloader::register();

// Import classes
use Shapefile\Shapefile;
use Shapefile\ShapefileException;
use Shapefile\ShapefileReader; 

    $response = array();

    $system = new System();
    
    $params = $_REQUEST;
    
    if( ! $system->init(@$params['db']) ){
        //get error and response
        $system->error_exit_api(); //exit from script
    }
    if(!(@$params['recID']>0)){
        $system->error_exit_api('recID parameter is not defined or has wrong value'); //exit from script
    }
    
    $params['simplify'] = true;

    $fields = array();
    
    if($system->defineConstant('DT_ZIP_FILE')){
        $fields[] = DT_ZIP_FILE;    
    }else{
        define('DT_ZIP_FILE',0);
    }
    if($system->defineConstant('DT_SHAPE_FILE')){
        $system->defineConstant('DT_DBF_FILE');
        $system->defineConstant('DT_SHX_FILE');
        $fields[] = DT_SHAPE_FILE;    
        $fields[] = DT_DBF_FILE;    
        $fields[] = DT_SHX_FILE;    
    }else{
        define('DT_SHAPE_FILE',0);
    }
    if($system->defineConstant('DT_FILE_RESOURCE')){
        $fields[] = DT_FILE_RESOURCE;    
    }else{
        define('DT_FILE_RESOURCE',0);
    }
    
    
    if( count($fields) == 0 ){
        $system->error_exit_api('Database '.$params['db']
                    .' does not have field definitions for shp, zip or simple resource file'
                    , HEURIST_SYSTEM_CONFIG); //exit from script
    }
    $isZipArchive = false;
    
    $record = array("rec_ID"=>$params['recID']);
    recordSearchDetails($system, $record, $fields);
    
    if (@$record["details"] &&
       (@$record["details"][DT_SHAPE_FILE] || @$record["details"][DT_ZIP_FILE] || @$record["details"][DT_FILE_RESOURCE]))
    {
        
            $dbf_file = null;
            $shx_file = null;

            if(DT_SHAPE_FILE>0 && @$record["details"][DT_SHAPE_FILE]){
                
                $shp_file = fileRetrievePath(array_shift($record["details"][DT_SHAPE_FILE]),'shp',false);
                $dbf_file = fileRetrievePath(array_shift($record["details"][DT_DBF_FILE]),'dbf',false);
                $shx_file = fileRetrievePath(array_shift($record["details"][DT_SHX_FILE]),'shx',false);
                
            }else if(DT_ZIP_FILE>0 && @$record["details"][DT_ZIP_FILE]){
                $shp_file = fileRetrievePath(array_shift($record["details"][DT_ZIP_FILE]),'shp',true);
                $isZipArchive = true;
            }else{
                $shp_file = fileRetrievePath(array_shift($record["details"][DT_FILE_RESOURCE]),'shp',true);
                $isZipArchive = true;
            }
            
            if(@$params['format']=='rawfile'){
                
                $originalFileName = 'Dataset_'.$params['recID'];
                $file_zip = $originalFileName.'.zip';
                $file_zip_full = tempnam(HEURIST_SCRATCHSPACE_DIR, "arc");
                $zip = new ZipArchive();
                if (!$zip->open($file_zip_full, ZIPARCHIVE::CREATE)) {
                    $system->error_exit_api("Cannot create zip $file_zip_full");
                }else{
                    if(!$dbf_file){
                        $dbf_file = substr($shp_file,0,strlen($shp_file)-3).'dbf';
                    }
                    if(!$shx_file){                       +
                        $shx_file = substr($shp_file,0,strlen($shp_file)-3).'dbf';
                    }
                    $zip->addFile($shp_file, basename($shp_file) );
                    if(file_exists($dbf_file)){
                        $zip->addFile($dbf_file, basename($dbf_file) );
                    }
                    if(file_exists($shx_file)){
                        $zip->addFile($shx_file, basename($shx_file) );
                    }
                    
                    if(@$params['metadata']){//save hml into scratch folder
                        
                        $file_metadata = $originalFileName.'.txt';
                        $file_metadata_full = tempnam(HEURIST_SCRATCHSPACE_DIR, "meta");
                        $url = HEURIST_BASE_URL.'export/xml/flathml.php?db='
                                    .$params['db']
                                    .'&q=ids:'.$params['metadata'].'&depth=0';
                        file_put_contents($file_metadata_full ,$url);
                        if(file_exists($file_metadata_full)){
                            $zip->addFile($file_metadata_full, $file_metadata);    
                        }
                    }
                    $zip->close();
                    //donwload
                    $contentDispositionField = 'Content-Disposition: attachment; '
                        . sprintf('filename="%s"; ', rawurlencode($file_zip))
                        . sprintf("filename*=utf-8''%s", rawurlencode($file_zip));            
                    
                    header('Content-Type: application/zip');
                    header($contentDispositionField);
                    header('Content-Length: ' . filesize($file_zip_full));
                    readfile($file_zip_full);
                    
                    
                }
                
            }else{
                
                try {
                
                    if($dbf_file && file_exists($dbf_file)){
                        
                        $files = array(
                            'shp'   => $shp_file,
                            'dbf'   => $dbf_file);
                            
                        if($shx_file && file_exists($shx_file)){
                            $files['shx'] = $shx_file;    
                        }
                        $shapeFile = new ShapefileReader($files);
                    }else if(file_exists($shp_file)){
                        //if provide only shapefile, it finds other automatically
                        $shapeFile = new ShapefileReader($shp_file);
                    }else{
                        $system->error_exit_api('Cannot process shp file', HEURIST_ERROR);
                    }
                    
                    //$json = array();
                    $tmp_destination = tempnam(HEURIST_SCRATCHSPACE_DIR, "exp");    
                    $fd = fopen($tmp_destination, 'w');  //less than 1MB in memory otherwise as temp file 
                    fwrite($fd, '[');
                    $rec_cnt = 0;
                    
                    // Read all the records
                    while ($record = $shapeFile->fetchRecord()){
                        
                        // Skip the record if marked as "deleted"
                        if ($record->isDeleted()) {
                            continue;
                        }
                        
                        /* v2 old way
                        $shapeFile->getRecord(Shapefile::GEOMETRY_GEOJSON_FEATURE)) { //GEOMETRY_WKT
                        if ($record['dbf']['_deleted']) continue;
                        
                        $record['shp']
                        */

                        $feature = json_decode($record->getGeoJSON(false, true), true);
                        unset($record);
                        
                        if(@$params['simplify']){
                            $geo = @$feature['geometry'];
                            if(is_array(@$geo['coordinates']) && count(@$geo['coordinates'])>0){
                                
                                if($geo['type']=='LineString'){

                                    simplifyCoordinates($geo['coordinates']);

                                } else if($geo['type']=='Polygon'){
                                    for($idx=0; $idx<count($geo['coordinates']); $idx++){
                                        simplifyCoordinates($geo['coordinates'][$idx]);
                                    }
                                } else if ( $geo['type']=='MultiPolygon' || $geo['type']=='MultiLineString')
                                {
                                    for($idx=0; $idx<count($geo['coordinates']); $idx++) //shapes
                                        for($idx2=0; $idx2<count($geo['coordinates'][$idx]); $idx2++) //points
                                            simplifyCoordinates($geo['coordinates'][$idx][$idx2]);
                                }
                            }    
                        } 
                        
                        //$json[] = $feature;
                        
                        if($rec_cnt>0) fwrite($fd, ',');
                        fwrite($fd, json_encode($feature));
                        $rec_cnt++;
                        if(memory_get_usage()>104857600){//100M //$rec_cnt>20 || 
                            break;
                        }
                    }//for records                    
 
                    fwrite($fd, ']');
                    if(true){
                        
                        if(true){                    
                            $output = gzencode(file_get_contents($tmp_destination), 6); 
                            header('Content-Encoding: gzip');
                        }else{
                            $output = file_get_contents($tmp_destination);
                        }
                        fclose($fd);
                        
                        header( 'Content-Type: application/json');    
                        //header('Content-Length: ' . strlen($output));
                        unlink($tmp_destination);
                        
                        echo $output; 
                        unset($output);   
                    
                    }else{

                        fclose($fd);
                        unlink($tmp_destination);
                        $json = json_encode($json);
                        header('Content-Type: application/json');
                        //header('Content-Type: application/vnd.geo+json');
                        //header('Content-Disposition: attachment; filename=output.json');
                        header('Content-Length: ' . strlen($json));
                        exit($json);
                    
                    }
                    

                } catch (ShapeFileException $e) {
                    // Print detailed error information
error_log($e->getCode().' ('.$e->getErrorType().'): '.$e->getMessage());                    
                    //.$e->getCode().' ('.$e->getErrorType().'): '
                    $system->error_exit_api('Cannot process shp file: '.$e->getMessage(), HEURIST_ERROR);
                } catch (Exception $e) {
error_log($e->getCode().' ('.$e->getErrorType().'): '.$e->getMessage());                    
                    $system->error_exit_api('Cannot init ShapeFile library: '.$e->getMessage(), HEURIST_ERROR);
                }                
                
            }
    }else{
        $system->error_exit_api('Record '
            .$params['recID']
            .' does not have fields where stored reference to shp or zip file',
            HEURIST_NOT_FOUND); 
    }
    
//
// $fileinfo as fileGetFullInfo
//
// 1) external file is saved in scratch
// 2) zipped extracted into scratch
//
function fileRetrievePath($fileinfo, $need_ext=null, $isArchive=false){
    
    if(@$fileinfo['file']){
        $fileinfo = $fileinfo['file']; //
    }
            
    $filepath = $fileinfo['fullPath'];  //concat(ulf_FilePath,ulf_FileName as fullPath
    $external_url = $fileinfo['ulf_ExternalFileReference'];
    $originalFileName = $fileinfo['ulf_OrigFileName'];
    $mimeType = $fileinfo['fxm_MimeType'];  //fxm_MimeType

    $filepath = resolveFilePath($filepath);

//DEBUG error_log($filepath.'  '.file_exists($filepath).'  '.$mimeType);  
    if(file_exists($filepath)){
        
    }else if($external_url){
        //tempnam(HEURIST_SCRATCH_DIR, 'remote_shp.zip');
        $filepath = tempnam(HEURIST_SCRATCH_DIR, '_remote_');
        /*if(!$isArchive && $need_ext!=null){
            //change tmp to required extension
            $filepath = substr($filepath,-3,3).$need_ext;    
        }*/
        saveURLasFile($external_url, $filepath);
    }    
    
    if(file_exists($filepath)){
        
        if($isArchive){ //$need_ext!==null){
            $destination = HEURIST_SCRATCH_DIR;//.$system->get_user_id().'/';
            
            $files = unzipArchiveFlat($filepath, $destination);
            
            if($files!==false){
                foreach ($files as $filename) {
                    
                        $path_parts = pathinfo($filename);
                        if(array_key_exists('extension', $path_parts))
                        {
                            $ext = strtolower($path_parts['extension']);
                            if(file_exists($filename) && $need_ext==$ext)
                            {
                                //returns only one shp file name, others are assuming
                                return $filename; 
                            }
                        }
                }
                return null; //not found
            }else{
                return null; //broken archive
            }
        }else{
            return $filepath;
        }       
        
    }
    
}
?>