'use strict';

var openedFileName;
var bindings = {
	showMaidUtil: false,
	version: "1.8.6",
	msgbox: {
		title: '',
		text: ''
	}
};

function showMsgbox(title, text) {
	bindings.msgbox.title = title;
	bindings.msgbox.text = text;
	$('#message').openModal();
}

function updateMaterialSelect(obj) {
	obj.material_select('update');
	obj.closest('.input-field').children('span.caret').remove();
}

function updateMaterialize() {
	$("input").change();
	$("textarea").change().keydown();
	updateMaterialSelect($('select'));
	setTimeout(function() {
		$('ul.tabs').tabs();
	}, 300);
}

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
	if (data instanceof ArrayBuffer) {
		data = new Uint8Array(data);
	}
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

$('#button-settings').click(function() {
	$('#settings').openModal();
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

rivets.formatters.rate = {
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

rivets.adapters['#'] = {
	observe: function(obj, keypath, callback) {},
	unobserve: function(obj, keypath, callback) {},
	get: function(obj, keypath) {
		keypath = JSON.parse(keypath);
		return obj.indexOf(keypath) !== -1;
	},
	set: function(obj, keypath, value) {
		keypath = JSON.parse(keypath);
		var idx = obj.indexOf(keypath);
		var existing = idx !== -1;
		if (existing !== value) {
			if (value) {
				obj.push(keypath);
			} else {
				obj.splice(idx, 1);
			}
		}
	}
}

var localStorageChangeCallback = {};
rivets.adapters['/'] = {
	observe: function(obj, keypath, callback) {
		localStorageChangeCallback[keypath] = localStorageChangeCallback[keypath] || [];
		localStorageChangeCallback[keypath].push(callback);
	},
	unobserve: function(obj, keypath, callback) {
		var obj = localStorageChangeCallback[keypath];
		if (obj) obj.splice(obj.indexOf(callback), 1);
	},
	get: function(obj, keypath) {
		try {
			return JSON.parse(localStorage[keypath]);
		} catch (e) {
			return undefined;
		}
	},
	set: function(obj, keypath, value) {
		localStorage[keypath] = JSON.stringify(value);
		var arrays = localStorageChangeCallback[keypath];
		if (arrays) arrays.forEach(function(i) {
			i();
		});
		$('#personality').material_select();
	}
}

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

function editFeature(guid) {
	$('#featureEditor').openModal();
};

function editPropensity(guid) {
	$('#propensityEditor').openModal();
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
	allItems: function() {
		var list = bindings.player.haveItemList;
		var keys = Object.getOwnPropertyNames(list);
		for (var i = 0; i < keys.length; i++) {
			if (list.propertyIsEnumerable(keys[i])) {
				list[keys[i]] = true;
			}
		}
		Materialize.toast(i18n.util.allItemsFinished, 4000);
	},
	allTrophies: function() {
		bindings.player.haveTrophyList = [
			1, 2, 3, 4, 5, 6, 7, 8, 9,
			10, 20, 30, 40, 50, 60, 70, 80, 90,
			100, 110, 120, 130, 140, 150, 160, 170, 180, 190,
			200, 210, 220, 230, 240, 250, 260, 270, 280, 290,
			300, 310, 320, 330, 340, 350, 360, 370, 380, 390,
			400, 410, 420, 430, 440, 450, 460, 470, 480, 490,
			/* Following trophy list provided by and credited to kanonmelodis */
			155, 192, 193, 194, 195,
			202, 222, 232, 234, 236, 238, 242, 244, 246, 248,
			500, 510, 520, 530, 540, 550, 560, 570, 580, 590,
			600, 610, 620, 630, 640, 650, 660, 670, 680, 690,
			700
		];
		Materialize.toast(i18n.util.allTrophiesFinished, 4000);
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
		var classes = [0, 1, 2, 3, 4, 5, 6];
		if (localStorage.ytgc001 === "true") classes.push(7);
		if (localStorage.ytgc002 === "true") classes.push(8);
		if (localStorage.ytgc003 === "true") classes.push(9);
		if (localStorage.dkg_winter === "true") classes.push(10);
		if (localStorage.plus === "true") classes.push(11, 12, 13, 14);
		if (localStorage.ytgc004 === "true") classes.push(15);
		if (localStorage.ytgc005 === "true") classes.push(16);
		if (localStorage.ytgc006 === "true") classes.push(17);
		if (localStorage.ytgc007 === "true") classes.push(18);
		if (localStorage.plus2 === "true") classes.push(19, 20, 21, 22);
		if (localStorage.dkg_summer === "true") classes.push(23);
		if (localStorage.ytgc008 === "true") classes.push(24);
		if (localStorage.ytgc009 === "true") classes.push(25);
		if (localStorage.ytgc010 === "true") classes.push(26);
		if (localStorage.dkg_winter2016 === "true") classes.push(27);
		if (localStorage.plus3 === "true") classes.push(28, 29);
		if (localStorage.ytgc011 === "true") classes.push(30);
		if (localStorage.liveEventDLC === "true") classes.push(31);
		if (localStorage.ytgc012 === "true") classes.push(32);
		if (localStorage.ytgc013 === "true") classes.push(33);
		if (localStorage.ytgc014 === "true") classes.push(34);
		if (localStorage.dkg_summer2017 === "true") classes.push(35);
		if (localStorage.ytgc015 === "true") classes.push(36);
		if (localStorage.bugbug === "true") classes.push(37);
		if (localStorage.ytgc016 === "true") classes.push(38);
		for (var i = 0; i < classes.length; i++) {
			var idx = classes[i];
			data[idx].have = true;
			data[idx].exp.currentExp = 0;
			data[idx].exp.level = 10;
			data[idx].exp.nextExp = 0;
			data[idx].exp.totalExp = 4530;
		}
		Materialize.toast(i18n.util.yotogiClassMaxFinished, 4000);
	},
	allSkills: function() {
		var data = bindings.maid.param.skillData;
		var skillIndex = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 260, 270, 280, 290, 300, 310, 320, 330, 340, 345, 350, 360, 370, 380, 390, 400, 410, 420, 430, 440, 450, 460, 470, 480, 490, 500, 510, 520, 530, 540, 550, 560, 570, 580, 590, 600, 610, 620, 630, 640, 650, 660, 670, 680, 690, 700, 710, 720, 730, 740, 750, 760, 770, 780, 790, 800, 810, 820, 830, 840, 850, 860, 870, 880, 890, 900, 910, 920, 930, 940, 950, 960, 970, 980, 990, 1000];
		if (localStorage.ytgc001 === "true") {
			skillIndex.push(1040, 1050, 1060, 1070, 1080, 1090, 1100, 1110);
		}
		if (localStorage.ytgc002 === "true") {
			skillIndex.push(1120, 1130, 1140, 1150, 1160, 1170, 1180, 1190);
		}
		if (localStorage.ytgc003 === "true") {
			skillIndex.push(1200, 1210, 1220, 1230, 1240, 1250, 1260, 1270, 1280);
		}
		if (localStorage.cbp === "true") {
			skillIndex.push(15, 25, 35, 55, 75, 95, 115, 135, 155, 175, 195, 225, 235, 245, 255, 265, 275, 285, 295, 305, 335, 347, 365, 375, 395, 405, 415, 425, 435, 445, 475, 485, 505, 515, 535, 545, 555, 575, 585, 595, 625, 645, 655, 665, 675, 695, 705, 715, 725, 755, 765, 1010, 1020);
		}
		if (localStorage.dkg_winter === 'true') {
			skillIndex.push(1290, 1300, 1310, 1320);
		}
		if (localStorage.dkg_winter_panties === 'true') {
			skillIndex.push(1330);
		}
		if (localStorage.plus === 'true') {
			for (var i = 1340; i <= 1510; i += 10) {
				skillIndex.push(i);
			}
		}
		if (localStorage.ytgc004 === 'true') {
			for (var i = 1520; i <= 1590; i += 10) {
				skillIndex.push(i);
			}
		}
		if (localStorage.ytgc005 === 'true') {
			for (var i = 1600; i <= 1680; i += 10) {
				skillIndex.push(i);
			}
		}
		if (localStorage.oneechan === 'true') {
			skillIndex.push(1690, 1700, 1780);
		}
		if (localStorage.ytgc006 === 'true') {
			for (var i = 1710; i <= 1770; i += 10) {
				skillIndex.push(i);
			}
		}
		if (localStorage.ytgc007 === 'true') {
			for (var i = 1790; i <= 1870; i += 10) {
				skillIndex.push(i);
			}
		}
		if (localStorage.plus2 === 'true') {
			for (var i = 1880; i <= 2260; i += 10) {
				skillIndex.push(i);
			}
		}
		if (localStorage.dkg_summer === "true") {
			skillIndex.push(2265, 2270, 2280, 2290, 2300, 2310, 2320, 2500);
		}
		if (localStorage.ytgc008 === "true") {
			for (var i = 2330; i <= 2400; i += 10) {
				skillIndex.push(i);
			}
		}
		if (localStorage.ytgc009 === "true") {
			for (var i = 2600; i <= 2680; i += 10) {
				skillIndex.push(i);
			}
		}
		if (localStorage.ytgc010 === "true") {
			skillIndex.push(2700);
			for (var i = 2800; i <= 2870; i += 10) {
				skillIndex.push(i);
			}
		}
		if (localStorage.dkg_winter2016 === "true") {
			for (var i = 3200; i <= 3240; i += 10) {
				skillIndex.push(i);
			}
		}
		if (localStorage.plus3 === "true") {
			for (var i = 2900; i <= 3180; i += 10) {
				skillIndex.push(i);
			}
		}
		if (localStorage.ytgc011 === "true") {
			for (var i = 3300; i <= 3360; i += 10) {
				skillIndex.push(i);
			}
		}
		if (localStorage.liveEventDLC === "true") {
			for (var i = 3400; i <= 3430; i += 10) {
				skillIndex.push(i);
			}
		}
		if (localStorage.ytgc012 === "true") {
			for (var i = 3500; i <= 3560; i += 10) {
				skillIndex.push(i);
			}
		}
		if (localStorage.ytgc013 === "true") {
			for (var i = 3700; i <= 3760; i += 10) {
				skillIndex.push(i);
			}
		}
		if (localStorage.ytgc014 === "true") {
			for (var i = 3800; i <= 3870; i += 10) {
				skillIndex.push(i);
			}
		}
		if (localStorage.dkg_summer2017 === "true") {
			skillIndex.push(3900, 3910, 3920);
		}
		if (localStorage.ytgc015 === "true") {
			for (var i = 4000; i <= 4070; i += 10) {
				skillIndex.push(i);
			}
		}
		if (localStorage.bugbug === "true") {
			skillIndex.push(4200, 4210, 4220, 4230);
		}
		if (localStorage.ytgc016 === "true") {
			for (var i = 4300; i <= 4370; i += 10) {
				skillIndex.push(i);
			}
		}
		for (var i = 0; i < skillIndex.length; i++) {
			var idx = skillIndex[i];
			if (data[idx]) {
				data[idx].exp.currentExp = 0;
				data[idx].exp.level = 3;
				data[idx].exp.nextExp = 0;
				data[idx].exp.totalExp = 300;
			} else {
				data[idx] = {
					exp: {
						currentExp: 0,
						level: 3,
						nextExp: 0,
						totalExp: 300
					},
					id: idx,
					playCount: 0
				};
			}
		}
		Materialize.toast(i18n.util.allSkillsFinished, 4000);
	},
	allWork: function() {
		var data = bindings.maid.param.workData;
		var workIndex = [1, 2, 3, 4, 5, 6, 7, 8, 9, 101, 1001, 1002];
		for (var i = 0; i < workIndex.length; i++) {
			var idx = workIndex[i];
			if (data[idx]) {
				data[idx].level = 3;
				data[idx].playCount = 20;
			} else {
				data[idx] = {
					id: idx,
					level: 3,
					playCount: 20
				};
			}
		}
		Materialize.toast(i18n.util.allWorkFinished, 4000);
	},
	masterPlayedSkills: function() {
		var data = bindings.maid.param.skillData;
		var skillIndex = Object.getOwnPropertyNames(data);
		for (var i = 0; i < skillIndex.length; i++) {
			var idx = skillIndex[i];
			if (data.propertyIsEnumerable(idx) && data[idx].playCount) {
				data[idx].exp.currentExp = 0;
				data[idx].exp.level = 3;
				data[idx].exp.nextExp = 0;
				data[idx].exp.totalExp = 300;
			}
		}
		Materialize.toast(i18n.util.masterPlayedSkillsFinished, 4000);
	},
	removeExGrpVIP: function() {
		bindings.maid.param.genericFlag.夜伽_カテゴリー_実行回数_乱交 = 0;
		bindings.maid.param.genericFlag.夜伽_カテゴリー_実行回数_交換 = 0;
		bindings.maid.param.genericFlag._PlayedNightWorkVip = 0;
		Materialize.toast(i18n.util.removeExGrpVIPFinished, 4000);
	},
	removeModItems: function() {
		var maids = bindings.save.chrMgr.stockMaid;
		var count = 0;
		for (var i = 0; i < maids.length; i++) {
			forEachKeys(maids[i].props, function(prop, key, value) {
				if (value.fileName.indexOf(".mod") !== -1) {
					count++;
					delete prop[key];
				}
			});
		}
		Materialize.toast(i18n.util.removeModItemsFinished.replace(/\$\{count\}/g, count), 4000);
	},
	finishAllVip: function() {
		for (var i = 101; i <= 2000; i++) {
			bindings.save.chrMgr.playerParam.nightWorksStateDic[i] = {
				calledMaidGuid: "",
				finish: true,
				workId: i
			};
		}

		Materialize.toast(i18n.util.finishAllVipDone, 4000);
	}
};

$(document).ready(function() {
	rivets.bind($('body'), i18n, {
		prefix: 'i18n',
		templateDelimiters: ['[', ']'],
	});
	rivets.bind($('body'), bindings, {
		prefix: 'bind'
	});
	$('select').material_select();
});


function forEachKeys(obj, callback) {
	var keys = Object.getOwnPropertyNames(obj);
	for (var i = 0; i < keys.length; i++) {
		if (obj.propertyIsEnumerable(keys[i])) {
			callback(obj, keys[i], obj[keys[i]]);
		}
	}
}

function showChangeLog() {
	var title = i18n.ui.updateNotice.replace('${version}', bindings.version);
	var body = '';
	forEachKeys(i18n.updateHistory, function(obj, key, value) {
		body += key + '<br/>' + value.map(function(a) {
			return '&emsp;&emsp;' + a + '<br/>';
		}).join('');
	});
	showMsgbox(
		title,
		i18n.ui.updateHistoryTemplate.replace('${body}', body)
	);
}

function checkVersion() {
	if (localStorage.version !== bindings.version) {
		localStorage.version = bindings.version;
		showChangeLog();
	}
}

function showAbout() {
	var body = '';
	forEachKeys(i18n.updateHistory, function(obj, key, value) {
		body += key + '<br/>' + value.map(function(a) {
			return '&emsp;&emsp;' + a + '<br/>';
		}).join('');
	});
	showMsgbox(
		i18n.ui.aboutTitle,
		i18n.ui.aboutTemplate.replace('${history}', body)
	);
}

function include(file, callback) {
	var script = document.createElement('script');
	script.src = file;
	script.onload = function() {
		document.head.removeChild(script);
		callback && callback();
	};
	document.head.appendChild(script);
}

function switchLocale(locale, callback) {
	var oldi18n = i18n;
	include('i18n/' + locale + '.js', function() {
		var newi18n = i18n;
		i18n = oldi18n;
		$.extend(oldi18n, newi18n);
		callback && callback();
	});
}

var locale = localStorage.locale || navigator.language || navigator.browserLanguage;
if (locale.indexOf("zh") !== -1) {
	switchLocale('zh', checkVersion);
} else {
	checkVersion();
}