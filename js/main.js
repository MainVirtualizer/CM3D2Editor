'use strict';

var openedFileName;
var bindings = {
	selectedTab: '#profile'
};

var i18n = {
	createurl: "创建链接",
	invalidsave: "不是有效的CM3D2存档",
	invalidjson: "不是有效的JSON",
	nothingloaded: "你还没有加载任何文件",

	bodyEditor: "身体编辑器",
	pleaseSelect: "请选择",

	utility: "工具",

	ui: {
		load: "载入",
		save: "保存",
		loadjson: "载入JSON",
		savejson: "保存JSON",
	},

	util: {
		unlockBodyLimits: "解锁全部女仆身高限制",
		unlockBodyLimitsFinished: "女仆身高限制已全部解锁",
		maidClassMax: "当前女仆的女仆称号升至满级",
		maidClassMaxFinished: "当前女仆的女仆称号已全部升至满级",
		yotogiClassMax: "当前女仆的夜伽称号升至满级",
		yotogiClassMaxFinished: "当前女仆的夜伽称号已全部升至满级",
	}

};

function updateMaterialSelect(obj) {
	obj.material_select('update');
	obj.closest('.input-field').children('span.caret').remove();
}

function updateMaterialize() {
	setTimeout(function() {
		$("input").change();
		$("textarea").change().keydown();
		updateMaterialSelect($('select'));
		$('.collapsible').collapsible();
		$('ul.tabs').tabs();
	}, 300);
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
	saveAs(new Blob([new Uint8Array(writeSaveData(bindings.save))]), openedFileName + '.save');
});

$('#button-savejson').click(function() {
	saveTextAs(JSON.stringify(bindings.save, null, 2), openedFileName + '.json');
});

$('#button-createurl').click(function() {
	var newWindow = window.open();
	newWindow.document.body.innerHTML = '如果安装了迅雷 请用右键另存为<br/><a download="' + openedFileName + '.save" href="' + createDataURL(writeSaveData(bindings.save)) + '">CM3D2 Save文件格式</a><br/>' + '<a download="' + openedFileName + '.json" href="' + createDataURL(JSON.stringify(bindings.save, null, 2)) + '">JSON文件格式</a>';
});

function loadJSON(model) {
	bindings.save = model;

	// Short path
	bindings.header = model.header;
	bindings.player = model.chrMgr.playerParam;

	// Select first tab
	$('a[href=#profile]').click();

	// Select first maid
	$($('a[maid-guid]')[0]).click();

	$('#saveEditor').show(200);
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
		if (value)
			return new Long(value[0], value[1]).toString();
		return '';
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

rivets.formatters.eval = function(data, string) {
	return new Function('$0', 'return ' + string)(data);
};

$(function() {
	var templates = $('script[type="text/template"]');
	for (var i = 0; i < templates.length; i++) {
		var t = $(templates[i]);
		t.before(t.text()).remove();
	}
});

function getMaidByGUID(guid) {
	var maids = bindings.save.chrMgr.stockMaid;
	for (var i = 0; i < maids.length; i++) {
		if (maids[i].param.guid === guid) return maids[i];
	}
	return null;
}

function selectMaid(guid) {
	bindings.maid = getMaidByGUID(guid);
	updateMaterialize();
}

function editBody(guid) {
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

var util = {
	unlockBodyLimits: function() {
		var allMaids = bindings.save.chrMgr.stockMaid;
		for (var i = 0; i < allMaids.length; i++) {
			var maid = allMaids[i];
			maid.props.DouPer.min = 0;
			maid.props.DouPer.max = 100;
			maid.props.sintyou.min = 0;
			maid.props.sintyou.max = 100;
		}
		Materialize.toast(i18n.util.unlockBodyLimitsFinished, 4000);
	},
	maidClassMax: function() {
		var data = bindings.maid.param.maidClassData;
		var totalExp = [320, 395, 395, 395, 500, 500, 500];
		for (var i = 0; i < 7; i++) {
			data[i].have = true;
			data[i].exp.currentExp = 0;
			data[i].exp.level = 10;
			data[i].exp.nextExp = 0;
			data[i].exp.totalExp = totalExp[i];
		}
		Materialize.toast(i18n.util.maidClassMaxFinished, 4000);
	},
	yotogiClassMax: function() {
		var data = bindings.maid.param.yotogiClassData;
		for (var i = 0; i < 7; i++) {
			data[i].have = true;
			data[i].exp.currentExp = 0;
			data[i].exp.level = 10;
			data[i].exp.nextExp = 0;
			data[i].exp.totalExp = 4530;
		}
		Materialize.toast(i18n.util.yotogiClassMaxFinished, 4000);
	}
}