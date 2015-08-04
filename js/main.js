'use strict';

var openedFileName;
var activeBind;
var activeModel;
var bindings = {};

var i18n = {
	createurl: "创建链接",
	invalidsave: "不是有效的CM3D2存档",
	invalidjson: "不是有效的JSON",
	nothingloaded: "你还没有加载任何文件",

	bodyEditor: "身体编辑器",
	pleaseSelect: "请选择"

};

function updateMaterialSelect(obj) {
	obj.material_select('update');
	obj.closest('.input-field').children('span.caret').remove();
}

function updateMaterialize() {
	$("input").change();
	$("textarea").change().keydown();
	updateMaterialSelect($('select'));
	$('.collapsible').collapsible();
}

// Setup Material select
$(document).ready(function() {
	rivets.bind($('body'), i18n, {
		prefix: 'i18n'
	});
	rivets.bind($('body'), bindings, {
		prefix: 'bind'
	});
	$('select').material_select();
});

function openOpenDialog(callback, accept) {
	var fileSelector = $('<input type="file">');
	if (accept) fileSelector.attr('accept', accept);
	fileSelector.change(function() {
		var files = fileSelector[0].files;
		if (files.length) {
			callback(files[0]);
		} else {
			callback(null);
		}
	});
	fileSelector.click();
}

function createDataURL(data) {
	var base64;
	if (data instanceof Uint8Array) {
		base64 = data.toBase64();
	} else {
		base64 = btoa(unescape(encodeURIComponent(data)));
	}
	return 'data:application/octet-stream;base64,' + base64;
}

$('#button-upload').click(function() {
	openOpenDialog(function(file) {
		if (file) {
			var reader = new FileReader();
			reader.onload = function() {
				try {
					loadJSON(parseSaveData(reader.result));
				} catch (e) {
					alert(i18n.invalidsave + ' ' + e.message);
				}
				openedFileName = file.name.replace(/\.[^.]+$/, '');
			}
			reader.readAsArrayBuffer(file);
		}
	}, '.save');
});

$('#button-loadjson').click(function() {
	openOpenDialog(function(file) {
		if (file) {
			var reader = new FileReader();
			reader.onload = function() {
				try {
					loadJSON(JSON.parse(reader.result));
				} catch (e) {
					alert(i18n.invalidjson);
				}
				openedFileName = file.name.replace(/\.[^.]+$/, '');
			}
			reader.readAsText(file);
		}
	}, '.json');
});

$('#button-download').click(function() {
	if (!activeModel) {
		alert(i18n.nothingloaded);
		return;
	}
	saveAs(new Blob([new Uint8Array(writeSaveData(activeModel))]), openedFileName + '.save');
});

$('#button-savejson').click(function() {
	if (!activeModel) {
		alert(i18n.nothingloaded);
		return;
	}
	saveTextAs(JSON.stringify(activeModel, null, 2), openedFileName + '.json');
});

$('#button-createurl').click(function() {
	if (!activeModel) {
		alert(i18n.nothingloaded);
		return;
	}
	var newWindow = window.open();
	newWindow.document.body.innerHTML = '如果安装了迅雷 请用右键另存为<br/><a download="' + openedFileName + '.save" href="' + createDataURL(writeSaveData(activeModel)) + '">CM3D2 Save文件格式</a><br/>' + '<a download="' + openedFileName + '.json" href="' + createDataURL(JSON.stringify(activeModel, null, 2)) + '">JSON文件格式</a>';
});

function loadJSON(model) {
	if (activeModel) {
		activeModel.version = model.version;
		activeModel.header = model.header;
		activeModel.chrMgr = model.chrMgr;
		activeModel.script = model.script;
	} else {
		activeModel = model;
		activeBind = rivets.bind($('body'), activeModel);
	}

	updateMaterialize();
}

function limitNum(value, min, max) {
	value = parseInt(value) || 0;
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

rivets.formatters.int32 = {
	read: function(value) {
		return value;
	},
	publish: function(value) {
		return parseInt(value) || 0;
	}
};

rivets.formatters.int64 = {
	read: function(value) {
		return new Long(value[0], value[1]).toString();
	},
	publish: function(value) {
		try {
			var long = Long.fromString(value);
		} catch (e) {
			return [0, 0];
		}
		return [long.low_, long.high_];
	}
};

rivets.formatters.studyRate = {
	read: function(value) {
		return value / 10;
	},
	publish: function(value) {
		value = parseFloat(value) || 0;
		return Math.round(value * 10);
	}
};

rivets.formatters._9999 = {
	read: function(value) {
		return value;
	},
	publish: function(value) {
		return limitNum(value, 0, 9999);
	}
};

rivets.formatters.image = function(base64) {
	return 'data:image/png;base64,' + base64;
}

rivets.formatters.format = function(data, string) {
	return string.replace('$0', data);
};

$(function() {
	var templates = $('script[type="text/template"]');
	for (var i = 0; i < templates.length; i++) {
		var t = $(templates[i]);
		t.before(t.text()).remove();
	}
});

function getMaidByGUID(guid) {
	var maids = activeModel.chrMgr.stockMaid;
	for (var i = 0; i < maids.length; i++) {
		if (maids[i].param.guid === guid) return maids[i];
	}
	return null;
}

function editBody(guid) {
	bindings.maid = getMaidByGUID(guid);

	$('#bodyEditor_selector').val('');
	bindings.bodyEditor.property = null;

	$('#bodyEditor').openModal();
};

bindings.bodyEditor = {
	property: null
};

var bodyEditor = {
	changeProperty: function(value) {
		bindings.bodyEditor.property = bindings.maid.props[value];
		updateMaterialize();
	}
};