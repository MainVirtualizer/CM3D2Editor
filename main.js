'use strict';

// Setup Material select
$(document).ready(function() {
	$('select').material_select();
});

$('#button-upload').click(function() {
	var fileSelector = $('<input type="file">');
	fileSelector.change(function() {
		var files = fileSelector[0].files;
		if (files.length) {
			var reader = new FileReader();
			reader.onload = function() {
				loadFile(reader.result);
			}
			reader.readAsText(files[0]);
		}
	});
	fileSelector.click();
});

$('#button-download').click(function() {
	saveTextAs(new XMLSerializer().serializeToString(json2xml('Osave', activeModel)), 'SaveData099.xml');
});

function loadFile(xml) {
	loadXML($($.parseXML(xml)));
}

var activeXMLDocument;
var activeOSave;
var activeModel;

var object;

var tagMatcher = /^[A-Z_]+/;

function createModelFromXML(xml) {
	var ret = {};
	var attributes = xml.attributes;
	for (var i = 0; i < attributes.length; i++) {
		var tagName = attributes[i].name;
		var tagType = tagName.match(tagMatcher)[0];
		var value = attributes[i].value;
		switch (tagType) {
			case "I":
				ret[tagName] = parseInt(value);
				break;
			case "LI":
				ret[tagName] = value.split(" ").map(function(item) {
					return parseInt(item);
				});
				break;
			case "L_":
				ret[tagName] = [];
				break;
			case "S":
				ret[tagName] = value;
				break;
			case "F":
				ret[tagName] = parseFloat(value);
				break;
			case "A":
				ret[tagName] = value; //TODO
				break;
			default:
				throw new Error("TagType " + tagType + " is not recognized");
		}
	}
	var children = xml.children;
	for (var i = 0; i < children.length; i++) {
		var tagName = children[i].tagName;
		var tagType = tagName.match(tagMatcher)[0];
		switch (tagType) {
			case "O":
				ret[tagName] = createModelFromXML(children[i]);
				break;
			case "LO":
				if (!ret[tagName])
					ret[tagName] = [];
				ret[tagName].push(createModelFromXML(children[i]))
				break;
			case "B":
				ret[tagName] = children[i].getAttribute("val").replace(' ', '');
				break;
			default:
				throw new Error("TagType " + tagType + " is not recognized");
		}
	}
	return ret;
}

function json2xml(name, object) {
	var ret = activeXMLDocument[0].createElement(name);
	var names = Object.getOwnPropertyNames(object);
	for (var i = 0; i < names.length; i++) {
		var tagName = names[i];
		var tagType = tagName.match(tagMatcher)[0];
		if (tagType === '_') continue;
		var value = object[tagName];
		switch (tagType) {
			case 'I':
			case 'F':
			case 'S':
			case 'A':
				ret.setAttribute(tagName, value);
				break;
			case 'L_':
				ret.setAttribute(tagName, '');
				break;
			case 'LI':
				ret.setAttribute(tagName, value.join(' '));
				break;
			case "O":
				ret.appendChild(json2xml(tagName, value));
				break;
			case "LO":
				for (var j = 0; j < value.length; j++) {
					ret.appendChild(json2xml(tagName, value[j]));
				}
				break;
			case "B":
				var node = activeXMLDocument[0].createElement(tagName);
				node.setAttribute('val', value);
				ret.appendChild(node);
				break;
			default:
				throw new Error("TagType " + tagType + " is not recognized");
		}
	}
	return ret;
}

function loadXML(xml) {
	activeXMLDocument = xml;
	activeOSave = extractSave(xml);
	activeModel = createModelFromXML(activeOSave[0]);

	rivets.bind($('#profile'), activeModel);

	$("input").change();
	$('select').material_select('update');
	$("select").closest('.input-field').children('span.caret').remove();
}

// Perform a simple validation to check if xml is a CM3D2 SaveData
function extractSave(xml) {
	var root = xml.children();
	if (root.length !== 1 || root[0].tagName !== 'Osave') {
		throw new Error('File is not valid CM3D2 SaveData');
	}
	var version = parseInt(root.attr('Iversion')) / 100;
	if (version !== 1.01) {
		alert('Version ' + version + ' support might be broken');
	}
	return root;
}

rivets.formatters.I = {
	read: function(value) {
		return value;
	},
	publish: function(value) {
		return parseInt(value);
	}
};