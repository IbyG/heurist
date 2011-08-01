/**
* manageRectypes.js
* A form to edit field type, or create a new field type. It is utilized as pop-up from manageDetailTypes and manageRectypes
* it may call another pop-ups: selectTerms and selectRecType
*
* 28/04/2011
* @author: Juan Adriaanse
* @author: Artem Osmakov
* @author: Stephen White
*
* @copyright (C) 2005-2011 University of Sydney Digital Innovation Unit.
* @link: http://HeuristScholar.org
* @license http://www.gnu.org/licenses/gpl-3.0.txt
* @package Heurist academic knowledge management system
* @todo
**/
var rectypeManager;

//aliases
var Dom = YAHOO.util.Dom,
	Hul = top.HEURIST.util;

function RectypeManager() {

	//private members
	var _className = "RectypeManager";

	var db = (top.HEURIST.parameters.db? top.HEURIST.parameters.db :
				(top.HEURIST.database.name?top.HEURIST.database.name:''));

	//keep table and source - to avoid repeat load and for filtering
	var arrTables = [],
	arrDataSources = [];

	var currentTipId,
		needHideTip = true,
		hideTimer;

	var _groups = [],  //for dropdown list
		_deleted = [], //keep removed types to exclude on filtering
		_cloneHEU = null; //keep Heurist for rollback in case user cancels group/visibility editing

	//object to send changes (visibility and group belong) for update on server
	var _oRecordType = {rectype:{
			colNames:{common:['rty_ShowInLists','rty_RecTypeGroupIDs'], dtFields:[]},
			defs: {}
	}};


	var _updatesCnt = 0, //number of affected rec types (visibility, group belong)
		_filterForAll = false,
		_filterText = "",
		_filterVisible = 0;

	var tabView = new YAHOO.widget.TabView();


	//
	//
	//
	function _init()
	{
		var grpID,
			ind = 0;
		//
		// init tabview with names of group
		for (grpID in top.HEURIST.rectypes.groups) {

			var grpName = top.HEURIST.rectypes.groups[grpID].name;
			var grpDescription = top.HEURIST.rectypes.groups[grpID].description;
			_addNewTab(ind, grpID, grpName, grpDescription);
			ind++;
		}//for groups

		tabView.addTab(new YAHOO.widget.Tab({
			id: "newGroup",
			label: "<label title='Create new group, edit or delete the existing group' style='font-style:italic'>edit</label>",
			content:
			('<div id="formGroupEditor" style="width:600px; padding:40px">'+
			'<h3 style="width:100%;text-align:center">Create a new rectype group or edit the existing one</h3><br/>'+
			'<div class="dtyField"><label class="dtyLabel">Group:</label><select id="edGroupId" onchange="onGroupChange()"></select></div>'+
			'<div class="dtyField"><label class="dtyLabel">Name:</label><input id="edName" style="width:300px"/></div>'+
			'<div class="dtyField"><label class="dtyLabel">Descrption:</label><input id="edDescription" style="width:300px"/></div>'+
			'<div style="text-align: center; margin:auto; padding-top:5;">'+
			'<input id="btnGrpSave" style="display:inline-block" type="button" value="Save" onclick="{rectypeManager.doGroupSave()}" />'+
			'<input id="btnGrpCancel" type="button" value="Cancel" onclick="{rectypeManager.doGroupCancel()}" />'+
			'</div><hr width="50%"/>'+
			'<div style="text-align: center; margin:auto; padding-top:5;">'+
			'Select group above for <input id="btnGrpDelete" type="button" value="Deletion" onclick="{rectypeManager.doGroupDelete()}" />'+
			'</div>'+
			'</div>')
		}));
		tabView.appendTo("modelTabs");


		var bookmarkedTabViewState = YAHOO.util.History.getBookmarkedState("tabview");
		var initialTabViewState = bookmarkedTabViewState || "tab0";

		YAHOO.util.History.register("tabview", initialTabViewState, function (state) {
			tabView.set("activeIndex", state.substr(3));	//restre the index from history
		});

		YAHOO.util.History.onReady(function () {
			var currentState;
			initTabView();

			currentState = YAHOO.util.History.getCurrentState("tabview");

			if(currentState && currentState.length>3) {
				tabView.set("activeIndex", currentState.substr(3));  //restore active tab from history
			}
		});

		try {
			YAHOO.util.History.initialize("yui-history-field", "yui-history-iframe");
		} catch (e) {
			initTabView();
		}

	}//end _init

	//
	// adds new tab and into 3 spec arrays
	//
	function _addNewTab(ind, grpID, grpName, grpDescription)
	{
		if(!Hul.isempty(grpDescription)){
			grpDescription = "Describe this group!";
		}

		_groups.push({value:grpID, text:grpName});

		tabView.addTab(new YAHOO.widget.Tab({
			id: grpID,
			label: "<label title='"+grpDescription+"'>"+grpName+"</label>",
			content:
			('<div>'+                   //for="filter"
			'<div style="display:inline-block;"><label>Filter by name:</label>'+
			'<input type="text" id="filter'+grpID+'" value="">&nbsp;&nbsp;'+
			'<input type="checkbox" id="filter'+grpID+'vis" value="1" style="padding-top:5px;">&nbsp;Show active only&nbsp;&nbsp;'+
			'<input type="checkbox" id="filter_forall'+grpID+'" value="1" style="padding-top:5px;">&nbsp;Apply for all groups'+
			'</div>'+
			'<div style="float:right; text-align:right">'+
				'<label id="lblNoticeAboutChanges'+grpID+'" '+
					'style="padding-left:3px; padding-right:3px; background-color:white; color:red; display: inline-block;"></label>'+
					'&nbsp;&nbsp;&nbsp;'+
				'<input id="btnSave'+grpID+'" type="button" value="Save Changes" '+
							'style="color:red; display: inline-block;"/>'+
				'<input type="button" id="btnAddRecordType'+grpID+'" value="Add Record Type" style="float:right;"/>'+
				//'<input type="button" id="btnAddFieldType'+grpID+'" value="Add Field Type" style="float:right;"/>'+
			'</div></div>'+
			'<div id="tabContainer'+grpID+'"></div></div>')

		}), ind);

		arrTables.push(null);
		arrDataSources.push(null);
	}

	//
	// on changing of tab - create and fill datatable for particular group
	//
	function _handleTabChange (e) {

		hideTimer = null;
		needHideTip = true;
		_hideToolTip();

		var option;

		var id = e.newValue.get("id");
		if(id==="newGroup"){
			//fill combobox on edit group form
			var sel = Dom.get('edGroupId');

			//celear selection list
			while (sel.length>0){
				sel.remove(0);
			}
			option = document.createElement("option");
			option.text = "new group";
			option.value = "-1";
			try {
				// for IE earlier than version 8
				sel.add(option, sel.options[null]);
			}catch (ex1){
				sel.add(option,null);
			}


			var i;
			for (i in _groups){
			if(!Hul.isnull(i)){


				option = document.createElement("option");
				option.text = _groups[i].text;
				option.value = _groups[i].value;
				try {
					// for IE earlier than version 8
					sel.add(option, sel.options[null]);
				}catch (ex2){
					sel.add(option,null);
				}
			}
			} // for

			Dom.get('edName').value = "";
			Dom.get('edDescription').value = "";

		}else if (e.newValue!==e.prevValue)
		{
			initTabContent(e.newValue);
		}
	}// end _handleTabChange

	//
	//add listener for tabview
	//
	function initTabView () {
		tabView.addListener("activeTabChange", _handleTabChange);

		//init the content for the first tab (table and buttons)
		tabView.set("activeIndex", 0);
	}

	// =============================================== START DATATABLE INIT
	//
	// create the content of tab: buttons and datatable
	//
	function initTabContent(tab) {

		var grpID = tab.get('id');

		_updateSaveNotice(grpID);

		var needFilterUpdate = false;
		var el1 = Dom.get('filter'+grpID);
		var el2 = Dom.get('filter'+grpID+'vis');

		if(_filterForAll){
			var newval = (_filterVisible === 1);
			needFilterUpdate = ((el1.value !== _filterText) || (el2.checked !== newval));
			el1.value = _filterText;
			el2.checked = (_filterVisible === 1);
		}else{
			_filterText = el1.value;
			_filterVisible = el2.checked?1:0;
		}
		Dom.get('filter_forall'+grpID).checked = _filterForAll;

		var _currentTabIndex = tabView.get('activeIndex');

		var dt = arrTables[_currentTabIndex];

		if(Hul.isnull(dt)) {

			var arr = [],
				rectypeID;
			//create datatable and fill it values of particular group
			for (rectypeID in top.HEURIST.rectypes.typedefs)
			{
				if(rectypeID !== "commomFieldNames" && rectypeID !== "dtFieldNames") {
					var td = top.HEURIST.rectypes.typedefs[rectypeID];
					var rectype = td.commonFields;
					if(rectype[9].indexOf(grpID)>-1) {
						arr.push([rectypeID, (Number(rectype[7])===1),
						"<img src=\"../../common/images/16x16.gif\" style=\"background-image:url(../../common/images/rectype-icons/"+rectypeID+".gif)\">",
						rectype[0], rectype[1], rectype[8], rectype[9], null]);

						/*TODO: top.HEURIST.rectype.rectypeUsage[rectypeID].length*/
					}
				}
			}

			var myDataSource = new YAHOO.util.LocalDataSource(arr,{
				responseType : YAHOO.util.DataSource.TYPE_JSARRAY,
				responseSchema : {
					fields: [ "id", "active", "icon", "name", "description", "status", "grp_id", "info"]
				},
				doBeforeCallback : function (req,raw,res,cb) {
					// This is the filter function
					var data  = res.results || [],
					filtered = [],
					i,l;

					if (!Hul.isempty(_filterText) || _filterVisible===1) {

						//var fvals = req.split("|");

						var sByName   = _filterText; //fvals[0].toLowerCase();
						var iByVisibility = _filterVisible; //fvals[1];

						// when we change the table, the datasource is not changed
						// thus we need an additional filter to filter out the deleted rows
						// and rows that were moved to another groups
						var tabIndex = tabView.get('activeIndex');
						var grpID = tabView.getTab(tabIndex).get('id');

						for (i = 0, l = data.length; i < l; ++i) {

							// when we change the table, the datasource is not changed
							//thus we need to update visibility manually
							var rec_ID = data[i].id;
							var df = _oRecordType.rectype.defs[rec_ID];
							if(!Hul.isnull(df)){
								data[i].active  = df.common[0];
								data[i].grp_id = df.common[1];
							}

							if ((data[i].name.toLowerCase().indexOf(sByName)>-1)
							&& (data[i].grp_id.indexOf(grpID)>-1)
							&& (_deleted.indexOf(rec_ID)<0)
							&& (iByVisibility===0 || Number(data[i].active)===iByVisibility))
							{
								filtered.push(data[i]);
							}
						}//for

						res.results = filtered;
					}

					return res;
				}
			});

			var myColumnDefs = [
			{ key: "id", label: "<u>Code</u>", sortable:true, width:20, className:'left' },
			{ key: "active", label: "Active", sortable:false, width:20, formatter:YAHOO.widget.DataTable.formatCheckbox, className:'center' },
			{ key: null, label: "Edit", sortable:false, width:20, formatter: function(elLiner, oRecord, oColumn, oData) {
					elLiner.innerHTML = '<a href="#edit_rectype"><img src="../../common/images/edit_icon.png" width="16" height="16" border="0" title="Edit record type" /><\/a>'; }
			},
			{ key: null, label: "Struc", sortable:false, width:20, formatter: function(elLiner, oRecord, oColumn, oData) {
					elLiner.innerHTML = '<a href="#edit_sctructure"><img src="../../common/images/edit_icon.png" width="16" height="16" border="0" title="Edit record strcuture" /><\/a>'; }
			},
			{ key: "usage", label: "Usage", hidden:true },
			{ key: "icon", label: "Icon", sortable:false },
			{ key: "name", label: "<u>Name</u>", sortable:true, className: 'bold_column', width:160,
				formatter: function(elLiner, oRecord, oColumn, oData) {
					var str = oRecord.getData("name");
					var tit = "";
					if(str.length>25) {
						tit = str;
						str = str.substr(0,25)+"&#8230";
					}
					elLiner.innerHTML = '<label title="'+tit+'">'+str+'</label>';
			}},
			{ key: "description", label: "Description", sortable:false, width:200,
				formatter: function(elLiner, oRecord, oColumn, oData) {
					var str = oRecord.getData("description");
					var tit = "";
					if(Hul.isempty(str)){
						str = "";
					}else if (str.length>35) {
						tit = str;
						str = str.substr(0,35)+"&#8230";
					}
					elLiner.innerHTML = '<label title="'+tit+'">'+str+'</label>';
			}},
			{ key: "status", label: "<u>Status</u>", sortable:true },
			{ key: "grp_id", label: "Group", sortable:false, width:70,
				formatter:YAHOO.widget.DataTable.formatDropdown, dropdownOptions:_groups},
			{ key: null, label: "Del", width:20, sortable:false, formatter: function(elLiner, oRecord, oColumn, oData) {
					elLiner.innerHTML = '<a href="#delete"><img src="../../common/images/cross.png" border="0" title="Delete" /><\/a>'; }
			},
			{ key: "info", label: "Info", sortable:false, width:20, formatter: function(elLiner, oRecord, oColumn, oData) {
				var rectypeID = oRecord.getData('id');
elLiner.innerHTML = '<img src="../../common/images/info_icon.png" width="16" height="16" border="0" '+
'onmouseover="rectypeManager.showInfo('+rectypeID+', event)" onmouseout="rectypeManager.hideInfo()"/>'; }

//elLiner.innerHTML = '<a href="#info"><img src="../../common/images/info_icon.png" width="16" height="16" border="0"/><\/a>'}

			}

			];

			var myConfigs = {
				//selectionMode: "singlecell",
				paginator : new YAHOO.widget.Paginator({
					rowsPerPage: 100,
					totalRecords: arr.length,

					// use a custom layout for pagination controls
					template: "Page: {PageLinks} &nbsp Show {RowsPerPageDropdown} per page",

					// show all links
					pageLinks: YAHOO.widget.Paginator.VALUE_UNLIMITED,

					// use these in the rows-per-page dropdown
					rowsPerPageOptions: [25, 50, 100]

				})
			};

			dt = new YAHOO.widget.DataTable('tabContainer'+grpID, myColumnDefs, myDataSource, myConfigs);

			//click on action images
			dt.subscribe('linkClickEvent', function(oArgs){
				YAHOO.util.Event.stopEvent(oArgs.event);

				var dt = this;
				var elLink = oArgs.target;
				var oRecord = dt.getRecord(elLink);
				var rectypeID = oRecord.getData("id");

				if(elLink.hash === "#edit_rectype") {
					_onAddEditRecordType(rectypeID, 0);
					// TO REMOVE editRectypeWindow(rectypeID);
				} else if(elLink.hash === "#edit_sctructure") {
					_editRecStructure(rectypeID);

				}else if(elLink.hash === "#delete"){
					var iUsage = 0; //@todo oRecord.getData('usage');
					if(iUsage<1){
						if(_needToSaveFirst()) { return; }

						var value = confirm("Do you really want to delete record type#"+rectypeID+"'"+oRecord.getData('name')+"'?");
						if(value) {

							function _updateAfterDelete(context) {

								if(Hul.isnull(context.error)){
									dt.deleteRow(oRecord.getId(), -1);
									alert("Record type #"+rectypeID+" was deleted");
									top.HEURIST.rectypes = context.rectypes;
									_cloneHEU = null;
								}
							}

							var db = (top.HEURIST.parameters.db? top.HEURIST.parameters.db :
							(top.HEURIST.database.name?top.HEURIST.database.name:''));
							var baseurl = top.HEURIST.baseURL + "admin/structure/saveStructure.php";
							var callback = _updateAfterDelete;
							var params = "method=deleteRT&db=" + db + "&rtyID=" + rectypeID;
							Hul.getJsonData(baseurl, callback, params);

						}
					}//iUsege<1
				}

			});

			// highlight listeners
			dt.subscribe("rowMouseoverEvent", dt.onEventHighlightRow);
			dt.subscribe("rowMouseoutEvent", dt.onEventUnhighlightRow);

			dt.subscribe('dropdownChangeEvent', function(oArgs){
				var elDropdown = oArgs.target;
				var record = this.getRecord(elDropdown);
				var column = this.getColumn(elDropdown);
				var newValue = elDropdown.options[elDropdown.selectedIndex].value;
				var oldValue = record.getData(column.key);
				var recordIndex = this.getRecordIndex(record);
				var recordKey = record.getData('recordKey');
				if(newValue!==oldValue){
					//this.deleteRow(recordIndex);
					var data = record.getData();
					data.grp_id = newValue;

					//remove destination table
					_removeTable(newValue, false);

					//remove from this table and refresh another one
					window.setTimeout(function() {
						dt.deleteRow(record.getId(), -1);
					}, 100);

					//keep the track of changes in special object
					_updateRecordType(record);
					_updateSaveNotice(oldValue);
				}
			});

			//subscribe on checkbox event (visibility)
			dt.subscribe("checkboxClickEvent", function(oArgs) {
				var elCheckbox = oArgs.target;
				var oRecord = dt.getRecord(elCheckbox);
				var data = oRecord.getData();
				data.active = elCheckbox.checked;//?1:0;

				//var recindex = dt.getRecordIndex(oRecord);
				//dt.updateRow(recindex, data);

				//keep the track of changes in special array
				_updateRecordType(oRecord);
			});

			//
			// keep the changes in object that will be send to server
			//
			function _updateRecordType(oRecord)
			{
				var rty_ID = oRecord.getData('id'),
					grp_id = oRecord.getData('grp_id');

				var newvals = [(oRecord.getData('active')?1:0), grp_id];

				//keep copy
				if(Hul.isnull(_cloneHEU)) { _cloneHEU = Hul.cloneObj(top.HEURIST.rectypes); }
				//update HEURIST
				var td = top.HEURIST.rectypes.typedefs[rty_ID];
				var deftype = td.commonFields;
				deftype[7] = newvals[0]; //visibility
				deftype[9] = newvals[1]; //group

				//update keep object
				//var dt_def = _oRecordType.rectype.defs[rty_ID];

				if(Hul.isnull(_oRecordType.rectype.defs[rty_ID])){
					_oRecordType.rectype.defs[rty_ID] = [];
					_oRecordType.rectype.defs[rty_ID].push({common:newvals,dtFields:[]});
					_updatesCnt++;
				}else{
					_oRecordType.rectype.defs[rty_ID][0].common = newvals;
				}

				_updateSaveNotice(grp_id);

			}

			/* MOVED TO LISTENERS OF INFO IMAGE
			 mouse over help colums shows the detailed description
			dt.on('cellMouseoverEvent', function (oArgs) {

				var target = oArgs.target;
				var column = this.getColumn(target);
				var rectypeID = null;

				if(!Hul.isnull(column) && column.key === 'info') {

					var record = this.getRecord(target);
					rectypeID = record.getData('id');
				}
				_showInfoToolTip(rectypeID, oArgs.event);
			});

			dt.on('cellMouseoutEvent', function (oArgs) {
				hideTimer = window.setTimeout(_hideToolTip, 2000);
			});
			*/


			arrTables[_currentTabIndex] = dt;
			arrDataSources[_currentTabIndex] = myDataSource;

			// add listeners
			var filter_forall = Dom.get('filter_forall'+grpID);
			filter_forall.onchange = function (e) {
				_filterForAll = filter_forall.checked;
				};

			var filter = Dom.get('filter'+grpID);
			filter.onkeyup = function (e) {
				clearTimeout(filterTimeout);
				filterTimeout = setTimeout(updateFilter,600);  };

			var filtervis = Dom.get('filter'+grpID+'vis');
			filtervis.onchange = function (e) {
				clearTimeout(filterTimeout);
				updateFilter();  };

			var btnAddRecordType = Dom.get('btnAddRecordType'+grpID);
			btnAddRecordType.onclick = function (e) {
				var currentTabIndex = tabView.get('activeIndex');
				var grpID = tabView.getTab(currentTabIndex).get('id');
				_onAddEditRecordType(0, grpID);
			};
			/*var btnAddFieldType = Dom.get('btnAddFieldType'+grpID);
			btnAddFieldType.onclick = function (e) {
				var currentTabIndex = tabView.get('activeIndex');
				var grpID = tabView.getTab(currentTabIndex).get('id');
				_onAddFieldType(0, 0);
			};*/


			//$$('.ellipsis').each(ellipsis);

		}//if(dt==undefined || dt==null)
		else if (needFilterUpdate){
			updateFilter();
		}
	}//initTabContent =============================================== END DATATABLE INIT


	/**
	* Show popup div with information about field types in use for given record type
	*/
	function _showInfoToolTip(rectypeID, event) {

				//tooltip div mouse out
				function __hideToolTip2() {
					needHideTip = true;
					//_hideToolTip();
					hideTimer = window.setTimeout(_hideToolTip, 500);
				}
				//tooltip div mouse over
				function __clearHideTimer2() {
					needHideTip = false;
					clearHideTimer();
				}

				var forceHideTip = true;
				var textTip;

				if(!Hul.isnull(rectypeID)){
					if(currentTipId !== rectypeID) {
						currentTipId = rectypeID;

						var recname = top.HEURIST.rectypes.names[rectypeID];
						if(recname.length>40) { recname = recname.substring(0,40)+"..."; }
						//find all records that reference this type
						var details = top.HEURIST.rectypes.typedefs[rectypeID].dtFields;
						textTip = '<div style="padding-left:20px;padding-top:4px"><b>'+recname+'</b><br/>'+
						'<div style="padding-left:20px;padding-top:4px"><b>Fields:</b><br/><label style="color: #4499ff;">Click on field type to edit</label></div><ul>';

						var detail;
						for(detail in details) {
							textTip = textTip + "<li><a href='javascript:void(0)' onClick=\"rectypeManager.editDetailType("+detail+")\">" + details[detail][0] + "</a></li>";
						}
						textTip = textTip + "</ul>";
					} else {
						forceHideTip = false;
					}
				}
				if(!Hul.isnull(textTip)) {
					clearHideTimer();
					needHideTip = true;
					var my_tooltip = $("#toolTip2");

					my_tooltip.mouseover(__clearHideTimer2);
					my_tooltip.mouseout(__hideToolTip2);

					var xy = Hul.getMousePos(event);
					my_tooltip.html(textTip);  //DEBUG xy[0]+",  "+xy[1]+"<br/>"+

					Hul.showPopupDivAt(my_tooltip, xy, $(window).scrollTop(), $(window).width(), $(window).height());
					hideTimer = window.setTimeout(_hideToolTip, 5000);
				}
				else if(forceHideTip) {
					_hideToolTip();
				}


	}

	//
	//
	//
	function _removeTable(grpID, needRefresh){

		var tabIndex = _getIndexByGroupId(grpID);

		var ndt = arrTables[tabIndex];
		if(!Hul.isnull(ndt)){

			//find parent tab
			var i;
			var tab = Dom.get('tabContainer'+grpID);
			for (i = 0; i < tab.children.length; i++) {
				tab.removeChild(tab.childNodes[0]);
			}
			// need to refill the destionation table,
			// otherwise datasource is not updated
			arrTables[tabIndex] = null; //.addRow(record.getData(), 0);

			var currIndex = tabView.get('activeIndex');
			if( (Number(tabIndex) === Number(currIndex)) && needRefresh)
			{
				initTabContent(tabView.getTab(tabIndex));
			}

		}
	}

	//  SAVE BUNCH OF TYPES =============================================================
	//
	// send updates to server
	//
	function _updateRecordTypeOnServer(event) {
		var str = YAHOO.lang.JSON.stringify(_oRecordType);
//DEBUG alert("Stringified changes: " + str);

		if(!Hul.isnull(str)) {
			//_updateResult(""); //debug
			//return;//debug

			var baseurl = top.HEURIST.baseURL + "admin/structure/saveStructure.php";
			var callback = _updateResult;
			var params = "method=saveRT&db="+db+"&data=" + encodeURIComponent(str);
			Hul.getJsonData(baseurl, callback, params);
		}
	}
	//
	// after saving a bunch of rec types
	//
	function _updateResult(context) {
		if(!context) {
			alert("An error occurred trying to contact the database");
		}else{
			var error = false,
				report = "",
				ind;

			for(ind in context.result)
			{
			if(!Hul.isnull(ind)){
				var item = context.result[ind];
				if(isNaN(item)){
					alert("An error occurred: " + item);
					error = true;
				}else{
					recTypeID = Number(item);
					if(!Hul.isempty(report)) { report = report + ","; }
					report = report + recTypeID;
				}
			}
			}

			if(!error) {
				if(report.indexOf(",")>0){
					alert("Record types with IDs :"+report+ " were succesfully updated");
				}else{
					alert("Record type with ID " + report + " was succesfully  updated");
				}
				_clearGroupAndVisibilityChanges(false);
			}
			top.HEURIST.rectypes = context.rectypes;
			_cloneHEU = null;
		}

	}

	/**
	* Show/hide information about number of fieldtypes with changed activity
	*/
	function _updateSaveNotice(grp_id){

		var _lblNotice = Dom.get("lblNoticeAboutChanges"+grp_id);
		var _btnSave   = Dom.get("btnSave"+grp_id);

		if(_updatesCnt>0){
			_lblNotice.innerHTML = 'You have changed <b>'+_updatesCnt+'</b> record type'+((_updatesCnt>1)?'s':'');
			_btnSave.style.display = 'inline-block';
			_btnSave.onclick = _updateRecordTypeOnServer;
		}else{
			_btnSave.style.display = 'none';
			_lblNotice.innerHTML = '';
		}
	}

	//
	// clear all changes with visibility and groups
	//
	function _clearGroupAndVisibilityChanges(withReload){
		_updatesCnt = 0;
		_oRecordType.rectype.defs = {}; //clear keeptrack

		_updateSaveNotice(_getGroupByIndex(tabView.get('activeIndex')));

		if(_cloneHEU) { top.HEURIST.rectypes = Hul.cloneObj(_cloneHEU); }
		_cloneHEU = null;

		if(withReload){
			var ind;
			for(ind in arrTables){
				if(!Hul.isnull(ind)){
					_removeTable( _getGroupByIndex(ind), true);
				}
			}
		}
	}
	//
	// if user chnaged visibility of group, it is required to save changes before new edit
	// (otherwise HEURIST will be rewritten and we get the mess)
	//
	function _needToSaveFirst(){
		if(_updatesCnt>0){
			var r = confirm("You have made changes. Before new edit you have to save them. Save?");
			if (r) {
				_updateRecordTypeOnServer(null);
			}else{
				_clearGroupAndVisibilityChanges(true);
			}
			return true;
		}else{
			return false;
		}
	}

	//  SAVE BUNCH OF TYPES ======================================================== END

	//
	//
	function clearHideTimer(){
		if (hideTimer) {
			window.clearTimeout(hideTimer);
			hideTimer = 0;
		}
	}
	function _hideToolTip(){
		if(needHideTip){
			currentTipId = null;
			clearHideTimer();
			var my_tooltip = $("#toolTip2");
			my_tooltip.css( {
				left:"-9999px"
			});
		}
	}

	//
	// filtering by name
	// listenter is activated along with dataTable creation
	//
	var filterTimeout = null;
	function updateFilter() {
		// Reset timeout
		filterTimeout = null;

		var tabIndex = tabView.get('activeIndex');
		var dtable = arrTables[tabIndex];
		var dsource = arrDataSources[tabIndex];

		// Reset sort
		var state = dtable.getState();
		state.sortedBy = {key:'name', dir:YAHOO.widget.DataTable.CLASS_ASC};

		var grpID = _getGroupByIndex(tabIndex);

		_filterText = Dom.get('filter'+grpID).value;
		_filterVisible = Dom.get('filter'+grpID+'vis').checked?1:0;

		// Get filtered data
		dsource.sendRequest(_filterText+'|'+_filterVisible, {
			success : dtable.onDataReturnInitializeTable,
			failure : dtable.onDataReturnInitializeTable,
			scope	  : dtable,
			argument : { pagination: { recordOffset: 0 } } // to jump to page 1
		});
	}

	//
	// call new popup - to edit detail type
	//
	function _editDetailType(detailTypeID) {

		var URL = "";
		if(detailTypeID) {
			URL = top.HEURIST.basePath + "admin/structure/editDetailType.html?db="+db+"&detailTypeID="+detailTypeID;
		}
		else {
			URL = top.HEURIST.basePath + "admin/structure/editDetailType.html?db="+db;
		}

		Hul.popupURL(top, URL, {
			"close-on-blur": false,
			"no-resize": false,
			height: 600,
			width: 640,
			callback: function(changedValues) {
				if(Hul.isnull(changedValues)) {
					// Canceled
				} else {
					// TODO: reload datatable
				}
			}
		});
	}

	//
	// edit strcuture (from image link in table)
	//
	function _editRecStructure(rty_ID) {

		var URL = top.HEURIST.basePath + "admin/structure/editRecStructure.html?db="+db+"&rty_ID="+rty_ID;
		this.location.replace(URL);

		/*
		Hul.popupURL(top, URL, {
			"close-on-blur": false,
			"no-resize": false,
			height: 480,
			width: 640,
			callback: function(context) {
				if(Hul.isnull(context)) {
					// Canceled
				} else {
					// alert("Structure is saved");
				}
			}
		});*/
	}

	/*  THIS feature is removed by Ian's request
	// listener of add button
	//
	function _onAddFieldType(){
		var url = top.HEURIST.basePath + "admin/structure/editDetailType.html?db="+db;

		Hul.popupURL(top, url,
		{   "close-on-blur": false,
			"no-resize": false,
			height: 430,
			width: 650,
			callback: function(context) {
				// NO ACTION REQUIRED HERE
			}
		});
	}*/

	//
	// listener of add button
	//
	function _onAddEditRecordType(rty_ID, rtg_ID){

		if(_needToSaveFirst()) { return; }

		var url = top.HEURIST.basePath + "admin/structure/editRectype.html?db="+db;
		if(rty_ID>0){
			url = url + "&rectypeID="+rty_ID; //existing
		}else{
			url = url + "&groupID="+rtg_ID; //new one
		}

		Hul.popupURL(top, url,
		{   "close-on-blur": false,
			"no-resize": false,
			height: 620,
			width: 620,
			callback: function(context) {
				if(!Hul.isnull(context)){

					var rty_ID;

					if(context.result){
					//update id
					rty_ID = Math.abs(Number(context.result[0]));

					//if user changes group in popup need update both  old and new group tabs
					var grpID_old = -1;
					if(Number(context.result[0])>0){
						grpID_old = top.HEURIST.rectypes.typedefs[rty_ID].commonFields[9];
					}

					//refresh the local heurist
					top.HEURIST.rectypes = context.rectypes;
					_cloneHEU = null;

					//detect what group
					var grpID = top.HEURIST.rectypes.typedefs[rty_ID].commonFields[9];

					_removeTable(grpID, true);
					if(grpID_old!==grpID){
						_removeTable(grpID_old, true);
					}

					}//context.result
					else{
						rty_ID = context.rty_ID;
					}

					if(context.isOpenEditStructure){
						_editRecStructure(rty_ID);
						//alert("open edit strcutre");
					}

					/*
					//is it current tab
					var ind = _getIndexByGroupId(grpID);
					var ind_old = _getIndexByGroupId(grpID_old);

					//refresh tables
					var tabIndex = tabView.get('activeIndex');

					var ndt = arrTables[ind];
					if(ndt!=null){
					arrTables[ind] = null;
					//if it is current tab force datatable refresh
					if(tabIndex == ind)
					{
					initTabContent(tabView.getTab(tabIndex));
					}
					}
					if(ind_old>=0){
					ndt = arrTables[ind_old];
					if(ndt!=null){
					arrTables[ind_old] = null;
					if (tabIndex == ind_old)
					{
					initTabContent(tabView.getTab(tabIndex));
					}
					}
					}
					*/
				}
			}
		});
	}

	//============================================ GROUPS
	//
	// managing goups
	//
	function _doGroupSave()
	{
		if(_needToSaveFirst()) { return; }

		var sel = Dom.get('edGroupId'),
		name = Dom.get('edName').value,
		description = Dom.get('edDescription').value,
		grpID = sel.options[sel.selectedIndex].value,
		grp; //object in HEURIST

		var orec = {rectypegroups:{
				colNames:['rtg_Name','rtg_Description'],
				defs: {}
		}};


		//define new or exisiting
		if(grpID<0) {
			grp = {name: name, description:description};
			orec.rectypegroups.defs[-1] = [];
			orec.rectypegroups.defs[-1].push({values:[name, description]});
		}else{
			//for existing - rename
			grp = top.HEURIST.rectypes.groups[grpID];
			grp.name = name;
			grp.description = description;
			orec.rectypegroups.defs[grpID] = [name, description];
		}

		//top.HEURIST.rectypes.groups[grpID] = grp;
		var str = YAHOO.lang.JSON.stringify(orec);

		//DEBUG alert(str);

		//make this tab active
		function _updateOnSaveGroup(context){
			//for new - add new tab
			if(!Hul.isnull(context['0'].error)){
				alert(context['0'].error);
			}else{
				var ind;
				top.HEURIST.rectypes = context.rectypes;
				_cloneHEU = null;

				if(grpID<0){
					grpID = context['0'].result;
					ind = _groups.length;
					_addNewTab(ind, grpID, name, description);
				}else{
					//update label
					for (ind in _groups){
					if(!Hul.isnull(ind) && Number(_groups[ind].value)===Number(grpID)){
						var tab = tabView.getTab(ind);
						var el = tab._getLabelEl();
						el.innerHTML = "<label title='"+description+"'>"+name+"</label>";
						_groups[ind].text = name;
						break;
					}}
				}
				tabView.set("activeIndex", ind);
			}
		}


		if(!Hul.isnull(str)){

			var baseurl = top.HEURIST.baseURL + "admin/structure/saveStructure.php";
			var callback = _updateOnSaveGroup;
			var params = "method=saveRTG&db="+db+"&data=" + encodeURIComponent(str);

			Hul.getJsonData(baseurl, callback, params);
		}


	}
	//
	//
	//
	function _doGroupDelete(){

		if(_needToSaveFirst()) { return; }

		var sel = Dom.get('edGroupId');
		var grpID = sel.options[sel.selectedIndex].value;

		if(grpID<0) { return; }

		var grp = top.HEURIST.rectypes.groups[grpID];

		if(!Hul.isnull(grp.types))
		{
			alert("There are types that belong to this group. Impossible to delete such group");
		}else{
			var r=confirm("Confirm the deletion of group '"+grp.name+"'");
			if (r) {
				var ind;
				//
				function _updateAfterDeleteGroup(context) {
					if(Hul.isnull(context.error)){
						//remove tab from tab view and select 0 index
						_groups.splice(ind, 1);
						arrTables.splice(ind, 1);
						arrDataSources.splice(ind, 1);

						tabView.removeTab(tabView.getTab(ind));
						tabView.set("activeIndex", 0);
						top.HEURIST.rectypes = context.rectypes;
						_cloneHEU = null;
					}
				}


				//1. find index of tab to be removed
				for (ind in _groups){
				if(!Hul.isnull(ind) && Number(_groups[ind].value)===Number(grpID)){

					var baseurl = top.HEURIST.baseURL + "admin/structure/saveStructure.php";
					var callback = _updateAfterDeleteGroup;
					var params = "method=deleteRTG&db="+db+"&rtgID=" + grpID;
					Hul.getJsonData(baseurl, callback, params);

					break;
				}}

			}
		}

	}
	//
	// just hide tab and back to previos one
	//
	function _doGroupCancel(){
		tabView.set("activeIndex", tabView.get('activeIndex'));
	}

	//
	//
	//
	function _getIndexByGroupId(grpID){
		var ind;
		for (ind in _groups){
			if(!Hul.isnull(ind) && _groups[ind].value===grpID){
				return ind;
			}
		}
		return -1;
	}
	//
	//
	//
	function _getGroupByIndex(ind){
		return _groups[ind].value;
	}


	//public members
	var that = {

		init: function(){
			_init();
		},
		editDetailType: _editDetailType,
		doGroupSave: function(){ _doGroupSave(); },
		doGroupDelete: function(){ _doGroupDelete(); },
		doGroupCancel: function(){ _doGroupCancel(); },
		hasChanges: function(){ return  (_updatesCnt>0); },
		showInfo: function(rectypeID, event){ _showInfoToolTip( rectypeID, event ); },
		hideInfo: function() { hideTimer = window.setTimeout(_hideToolTip, 1000); },

		getClass: function () {
			return _className;
		},

		isA: function (strClass) {
			return (strClass === _className);
		}

	};

	return that;
}

//
//
//
function onGroupChange() {
	var sel = Dom.get('edGroupId'),
	edName = Dom.get('edName'),
	edDescription = Dom.get('edDescription'),
	grpID = sel.options[sel.selectedIndex].value;

	if(grpID<0){
		edName.value = "";
		edDescription.value = "";
	}else{
		edName.value = top.HEURIST.rectypes.groups[grpID].name;
		edDescription.value = top.HEURIST.rectypes.groups[grpID].description;
	}

}

/*

function ellipsis(e) {
var w = e.getWidth() - 10000;
var t = e.innerHTML;
e.innerHTML = "<span>" + t + "</span>";
e = e.down();
while (t.length > 0 && e.getWidth() >= w) {
t = t.substr(0, t.length - 1);
e.innerHTML = t + "...";
}
}

document.write('<style type="text/css">' +
'.ellipsis { margin-right:-10000px; }</style>');

$j(document).ready(function(){
$j('.ellipsis').each(function (i) {
var e = this;
var w = $j(e).width() - 10000;
var t = e.innerHTML;
$j(e).html("<span>" + t + "</span>");
e = $j(e).children(":first-child")
while (t.length > 0 && $j(e).width() >= w) {
t = t.substr(0, t.length - 1);
$j(e).html(t + "...");
}
});
});
*/
