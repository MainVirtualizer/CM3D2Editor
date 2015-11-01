function BinaryReader(buffer) {
	this.view = new DataView(buffer);
	this.ptr = 0;
}

BinaryReader.prototype.readByte = function() {
	return this.view.getUint8(this.ptr++);
};

BinaryReader.prototype.readSingle = function() {
	var ret = this.view.getFloat32(this.ptr, true);
	this.ptr += 4;
	return ret;
};

BinaryReader.prototype.readInt32 = function() {
	var ret = this.view.getInt32(this.ptr, true);
	this.ptr += 4;
	return ret;
};

BinaryReader.prototype.readUInt32 = function() {
	var ret = this.view.getUint32(this.ptr, true);
	this.ptr += 4;
	return ret;
};

BinaryReader.prototype.readInt64 = function() {
	var lo = this.readInt32();
	var hi = this.readInt32();
	return [lo, hi];
};

BinaryReader.prototype.readBoolean = function() {
	return this.readByte() !== 0;
};

BinaryReader.prototype.read7BitEncodedInt = function() {
	var value = 0,
		shift = 0,
		byte;
	do {
		byte = this.readByte();
		value |= (byte & 0x7F) << shift;
		shift += 7;
	} while (byte & 0x80);
	return value;
};

BinaryReader.prototype.readString = function() {
	var length = this.read7BitEncodedInt();
	var ret = '';
	for (var i = 0; i < length; i++) {
		ret += String.fromCharCode(this.readByte());
	}
	return decodeURIComponent(escape(ret));
};

BinaryReader.prototype.readEOF = function() {
	if (this.ptr !== this.view.byteLength) {
		throw new Error('Expected EOF');
	}
};

function BinaryWriter() {
	this.buffer = new ArrayBuffer(4096);
	this.view = new DataView(this.buffer);
	this.ptr = 0;
}

BinaryWriter.prototype.ensureCapacity = function(ext) {
	var len = this.buffer.byteLength;
	if (this.ptr + ext > len) {
		var newBuf = new ArrayBuffer(Math.max(this.ptr + ext, len + (len >> 1)));
		var newView = new Uint8Array(newBuf);
		var oldView = new Uint8Array(this.buffer);
		for (var i = 0; i < this.ptr; i++) {
			newView[i] = oldView[i];
		}
		this.buffer = newBuf;
		this.view = new DataView(newBuf);
	}
};

BinaryWriter.prototype.writeByte = function(val) {
	this.ensureCapacity(1);
	this.view.setUint8(this.ptr++, val);
};

BinaryWriter.prototype.write7BitEncodedInt = function(val) {
	val >>>= 0;
	while (val >= 0x80) {
		this.writeByte((val & 0x7F) | 0x80);
		val >>>= 7;
	}
	this.writeByte(val);
};

BinaryWriter.prototype.writeString = function(val) {
	val = unescape(encodeURIComponent(val));
	this.write7BitEncodedInt(val.length);
	for (var i = 0; i < val.length; i++) {
		this.writeByte(val.charCodeAt(i));
	}
};

BinaryWriter.prototype.writeSingle = function(val) {
	this.ensureCapacity(4);
	this.view.setFloat32(this.ptr, val, true);
	this.ptr += 4;
};

BinaryWriter.prototype.writeInt32 = function(val) {
	this.ensureCapacity(4);
	this.view.setInt32(this.ptr, val, true);
	this.ptr += 4;
};

BinaryWriter.prototype.writeUInt32 = function(val) {
	this.ensureCapacity(4);
	this.view.setUint32(this.ptr, val, true);
	this.ptr += 4;
};

BinaryWriter.prototype.writeInt64 = function(val) {
	this.writeInt32(val[0]);
	this.writeInt32(val[1]);
};

BinaryWriter.prototype.writeBoolean = function(val) {
	this.writeByte(val ? 1 : 0);
};

BinaryWriter.prototype.getBuffer = function() {
	return this.buffer.slice(0, this.ptr);
};

Uint8Array.prototype.toBase64 = function() {
	var output = '';
	var num = 0;
	var bits = 0;
	for (var i = 0; i < this.byteLength; i++) {
		num <<= 8;
		num |= this[i];
		bits += 8;
		while (bits >= 6) {
			bits -= 6;
			output += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" [num >> bits];
			num &= ~(0x3F << bits);
		}
	}
	if (bits) {
		num <<= 6 - bits;
		output += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" [num];
	}
	output += "===".substring((this.byteLength + 2) % 3 + 1);
	return output;
};

Uint8Array.fromBase64 = function(input) {
	if (input.length % 4 !== 0 || !(/[A-Za-z0-9+\/]*={0,2}/.test(input))) {
		throw new Error('Invalid base64');
	}
	var len = input.length / 4 * 3;
	if (input.indexOf('=') !== -1) {
		len -= input.length - input.indexOf('=');
	}
	var arr = new Uint8Array(len);

	var mapping = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
	for (var i = 0, j = 0; i < input.length; i += 4, j += 3) {
		var val = (mapping.indexOf(input[i]) << 18) |
			(mapping.indexOf(input[i + 1]) << 12) |
			(mapping.indexOf(input[i + 2]) << 6) |
			mapping.indexOf(input[i + 3]);
		arr[j] = (val >> 16) & 0xFF;
		arr[j + 1] = (val >> 8) & 0xFF;
		arr[j + 2] = val & 0xFF;
	}

	return arr;
};

(function(exports) {
	var suppressVersion;

	function getKeys(obj) {
		return Object.getOwnPropertyNames(obj).filter(function(name) {
			return name !== '_rv';
		});
	}

	function checkVersion(version) {
		if (version > 115 || version < 101) {
			if (suppressVersion === undefined) {
				if (exports.confirm) {
					suppressVersion = exports.confirm('Unsupported version. Continue?');
				}
			}
			if (!suppressVersion) {
				throw new Error('Version ' + (version / 100) + ' is not supported');
			}
		}
	}

	function parseRGBA(reader) {
		return {
			r: reader.readSingle(),
			g: reader.readSingle(),
			b: reader.readSingle(),
			a: reader.readSingle()
		};
	}

	function parseExperience(reader) {
		return {
			currentExp: reader.readInt32(),
			totalExp: reader.readInt32(),
			nextExp: reader.readInt32(),
			level: reader.readInt32()
		};
	}

	function parseMaidProp(reader) {
		if (reader.readString() !== 'CM3D2_MPROP') {
			throw new Error('Expected CM3D2_MPROP');
		}
		checkVersion(reader.readInt32());

		var ret = {};
		ret.idx = reader.readInt32();
		ret.name = reader.readString();
		ret.type = reader.readInt32();
		ret.valueDefault = reader.readInt32();
		ret.value = reader.readInt32();
		ret.tempValue = reader.readInt32();
		ret.valueLinkMax = reader.readInt32();
		ret.fileName = reader.readString();
		ret.fileNameRid = reader.readInt32();
		ret.dut = reader.readBoolean();
		ret.max = reader.readInt32();
		ret.min = reader.readInt32();
		return ret;
	}

	function parsePartsColor(reader) {
		return {
			use: reader.readBoolean(),
			mainHue: reader.readInt32(),
			mainChroma: reader.readInt32(),
			mainBrightness: reader.readInt32(),
			mainConstrast: reader.readInt32(),
			shadowRate: reader.readInt32(),
			shadowHue: reader.readInt32(),
			shadowChroma: reader.readInt32(),
			shadowBrightness: reader.readInt32(),
			shadowContrast: reader.readInt32()
		};
	}

	function parseMaidParts(reader) {
		if (reader.readString() !== 'CM3D2_MULTI_COL') {
			throw new Error('Expected CM3D2_MULTI_COL');
		}
		checkVersion(reader.readInt32());

		var ret = [];
		for (var i = reader.readInt32(); i > 0; i--) {
			ret.push(parsePartsColor(reader));
		}

		return ret;
	}

	function parseMaidParam(reader) {
		if (reader.readString() !== 'CM3D2_MAID_PPARAM') {
			throw new Error('Expected CM3D2_MAID_PPARAM');
		}
		checkVersion(reader.readInt32());
		var ret = {
			guid: reader.readString(),
			createTime: reader.readString(),
			createTimeNum: reader.readInt64(),
			employmentDay: reader.readInt32(),
			maidPoint: reader.readInt32(),
			lastName: reader.readString(),
			firstName: reader.readString(),
			profile: reader.readString(),
			freeComment: reader.readString(),
			initSeikeiken: reader.readInt32(), // Seikeiken
			seikeiken: reader.readInt32(), // Seikeiken
			personal: reader.readInt32(), // Personal
			contractType: reader.readInt32(), // ContractType
			maidClassData: (function() {
				var ret = [];
				for (var i = reader.readInt32(); i > 0; i--) {
					ret.push({
						have: reader.readBoolean(),
						exp: parseExperience(reader)
					});
				}
				return ret;
			})(),
			currentMaidClass: reader.readInt32(), //MaidClassType,
			yotogiClassData: (function() {
				var ret = [];
				for (var i = reader.readInt32(); i > 0; i--) {
					ret.push({
						have: reader.readBoolean(),
						exp: parseExperience(reader)
					});
				}
				return ret;
			})(),
			currentYotogiClass: reader.readInt32(), // YotogiClassType
			feature: (function() {
				var ret = [];
				for (var i = reader.readInt32(); i > 0; i--) {
					ret.push(reader.readInt32()); // Feature
				}
				return ret;
			})(),
			propensity: (function() {
				var ret = [];
				for (var i = reader.readInt32(); i > 0; i--) {
					ret.push(reader.readInt32()); // Propensity
				}
				return ret;
			})(),
			body: {
				height: reader.readInt32(),
				weight: reader.readInt32(),
				bust: reader.readInt32(),
				waist: reader.readInt32(),
				hip: reader.readInt32(),
				cup: reader.readString()
			},
			condition: reader.readInt32(), // Condition
			conditionSpecial: reader.readInt32(), // ConditionSpecial
			yotogiPlayCount: reader.readInt32(),
			othersPlayCount: reader.readInt32(),
			likability: reader.readInt32(),
			studyRate: reader.readInt32(),
			curHp: reader.readInt32(),
			hp: reader.readInt32(),
			curMind: reader.readInt32(),
			mind: reader.readInt32(),
			curReason: reader.readInt32(),
			reason: reader.readInt32(),
			reception: reader.readInt32(),
			care: reader.readInt32(),
			lovely: reader.readInt32(),
			inyoku: reader.readInt32(),
			elegance: reader.readInt32(),
			mValue: reader.readInt32(),
			charm: reader.readInt32(),
			hentai: reader.readInt32(),
			housi: reader.readInt32(),
			teachRate: reader.readInt32(),
			sexual: {
				mouth: reader.readInt32(),
				throat: reader.readInt32(),
				nipple: reader.readInt32(),
				front: reader.readInt32(),
				back: reader.readInt32(),
				curi: reader.readInt32()
			},
			play_number: reader.readInt32(),
			frustration: reader.readInt32(),
			popularRank: reader.readInt32(),
			evaluation: reader.readInt64(),
			totalEvaluation: reader.readInt64(),
			sales: reader.readInt64(),
			totalSales: reader.readInt64(),
			isFirstNameCall: reader.readBoolean(),
			isRentalMaid: reader.readBoolean(),
			noonWorkID: reader.readInt32(),
			nightWorkID: reader.readInt32(),
			skillData: (function() {
				var ret = {};
				for (var i = reader.readInt32(); i > 0; i--) {
					ret[reader.readInt32()] = {
						id: reader.readInt32(),
						playCount: reader.readUInt32(),
						exp: parseExperience(reader)
					};
				}
				return ret;
			})(),
			workData: (function() {
				var ret = {};
				for (var i = reader.readInt32(); i > 0; i--) {
					ret[reader.readInt32()] = {
						id: reader.readInt32(),
						playCount: reader.readUInt32(),
						level: reader.readInt32()
					};
				}
				return ret;
			})(),
			genericFlag: (function() {
				var ret = {};
				for (var i = reader.readInt32(); i > 0; i--) {
					ret[reader.readString()] = reader.readInt32();
				}
				return ret;
			})(),
			employment: reader.readBoolean(),
			leader: reader.readBoolean(),
			eyePartsTab: reader.readInt32(), // EyePartsTab
			partsDic: (function() {
				var ret = {};
				for (var i = reader.readInt32(); i > 0; i--) {
					ret[reader.readString()] = reader.readString();
				}
				return ret;
			})(),
			maidClassBonusStatus: {
				hp: reader.readInt32(),
				mind: reader.readInt32(),
				reception: reader.readInt32(),
				care: reader.readInt32(),
				lovely: reader.readInt32(),
				inyoku: reader.readInt32(),
				elegance: reader.readInt32(),
				mValue: reader.readInt32(),
				charm: reader.readInt32(),
				hentai: reader.readInt32(),
				housi: reader.readInt32(),
				teachRate: reader.readInt32()
			}
		};

		if (reader.readInt32() !== 1923480616) {
			throw new Error('Magic number mismatch');
		}

		return ret;
	}

	function parseBinaryData(reader) {
		var length = reader.readInt32();
		var data = new Uint8Array(length);
		for (var i = 0; i < length; i++) {
			data[i] = reader.readByte();
		}
		return data.toBase64();
	}

	function parseMaidMisc(reader) {
		if (reader.readString() !== 'CM3D2_MAID_MISC') {
			throw new Error('Expected CM3D2_MAID_MISC');
		}
		checkVersion(reader.readInt32());
		var ret = {};
		ret.activeSlotNo = reader.readInt32();
		ret.texIcon = parseBinaryData(reader);
		ret.thumbCardTime = reader.readString();
		ret.colorMan = parseRGBA(reader);
		return ret;
	}

	function parseMaidProps(reader) {
		if (reader.readString() !== 'CM3D2_MPROP_LIST') {
			throw new Error('Expected CM3D2_MPROP_LIST');
		}
		checkVersion(reader.readInt32());

		var props = {};
		for (var i = reader.readInt32(); i > 0; i--) {
			props[reader.readString()] = parseMaidProp(reader);
		}

		return props;
	}

	function parsePlayerParam(reader) {
		if (reader.readString() !== 'CM3D2_PPARAM') {
			throw new Error('Expected CM3D2_PPARAM');
		}
		checkVersion(reader.readInt32());

		var ret = {
			playerName: reader.readString(),
			scenarioPhase: reader.readInt32(),
			phaseDays: reader.readInt32(),
			days: reader.readInt32(),
			shopUseMoney: reader.readInt64(),
			money: reader.readInt64(),
			initSalonLoan: reader.readInt64(),
			salonLoan: reader.readInt64(),
			salonClean: reader.readInt32(),
			salonBeautiful: reader.readInt32(),
			salonEvaluation: reader.readInt32(),
			isFirstNameCall: reader.readBoolean(),
			currentSalonGrade: reader.readInt32(),
			bestSalonGrade: reader.readInt32(),
			scheduleSlots: [],
			genericFlag: {},
			nightWorksStateDic: {},
			shopLineupDic: {},
			haveItemList: {},
			haveTrophyList: [],
			maidClassOpenFlag: [],
			yotogiClassOpenFlag: [],
		};

		for (var i = 0; i < 6; i++) {
			var schedule = {
				maidGuid: reader.readString(),
				noonSuccessLevel: reader.readInt32(),
				nightSuccessLevel: reader.readInt32(),
				communication: reader.readBoolean(),
				backupStatusDic: {}
			};
			for (var j = reader.readInt32(); j > 0; j--) {
				schedule.backupStatusDic[reader.readString()] = reader.readInt32();
			}
			ret.scheduleSlots[i] = schedule;
		}

		for (var i = reader.readInt32(); i > 0; i--) {
			ret.genericFlag[reader.readString()] = reader.readInt32();
		}

		for (var i = reader.readInt32(); i > 0; i--) {
			ret.nightWorksStateDic[reader.readInt32()] = {
				workId: reader.readInt32(),
				calledMaidGuid: reader.readString(),
				finish: reader.readBoolean()
			};
		}

		for (var i = reader.readInt32(); i > 0; i--) {
			ret.shopLineupDic[reader.readInt32()] = reader.readInt32();
		}

		for (var i = reader.readInt32(); i > 0; i--) {
			ret.haveItemList[reader.readString()] = reader.readBoolean();
		}

		for (var i = reader.readInt32(); i > 0; i--) {
			ret.haveTrophyList.push(reader.readInt32());
		}

		for (var i = reader.readInt32(); i > 0; i--) {
			ret.maidClassOpenFlag.push(reader.readInt32());
		}

		for (var i = reader.readInt32(); i > 0; i--) {
			ret.yotogiClassOpenFlag.push(reader.readInt32());
		}

		if (reader.readInt32() !== 348195810) {
			throw new Error('Magic number mismatch');
		}

		return ret;
	}

	function parseSaveData(buffer) {
		suppressVersion = undefined;

		var reader = new BinaryReader(buffer);
		if (reader.readString() !== 'CM3D2_SAVE') {
			throw new Error('Expected CM3D2_SAVE');
		}
		var version = reader.readInt32();
		checkVersion(version);

		var ret = {
			version: version,
			header: {
				saveTime: reader.readString(),
				gameDay: reader.readInt32(),
				playerName: reader.readString(),
				maidNum: reader.readInt32(),
				comment: reader.readString(),
			},
			chrMgr: {
				playerParam: null,
				stockMan: [],
				stockMaid: []
			},
			script: null
		}

		if (reader.readString() !== 'CM3D2_CHR_MGR') {
			throw new Error('Expected CM3D2_CHR_MGR');
		}
		checkVersion(reader.readInt32());

		ret.chrMgr.playerParam = parsePlayerParam(reader);

		for (var i = reader.readInt32(); i > 0; i--) {
			ret.chrMgr.stockMan.push({
				props: parseMaidProps(reader),
				misc: parseMaidMisc(reader)
			});
		}

		for (var i = reader.readInt32(); i > 0; i--) {
			ret.chrMgr.stockMaid.push({
				props: parseMaidProps(reader),
				parts: parseMaidParts(reader),
				param: parseMaidParam(reader),
				misc: parseMaidMisc(reader)
			});
		}

		if (reader.readString() !== 'CM3D2_SCRIPT') {
			throw new Error('Expected CM3D2_SCRIPT');
		}
		checkVersion(reader.readInt32());

		if (reader.readString() !== 'CM3D2_KAG') {
			throw new Error('Expected CM3D2_KAG');
		}
		checkVersion(reader.readInt32());

		ret.script = {
			kag: parseBinaryData(reader),
			fadeWait: reader.readBoolean(),
			enabled: reader.readBoolean()
		};

		reader.readEOF();

		return ret;
	}

	function writeRGBA(writer, data) {
		writer.writeSingle(data.r);
		writer.writeSingle(data.g);
		writer.writeSingle(data.b);
		writer.writeSingle(data.a);
	}

	function writeExperience(writer, data) {
		writer.writeInt32(data.currentExp);
		writer.writeInt32(data.totalExp);
		writer.writeInt32(data.nextExp);
		writer.writeInt32(data.level);
	}

	function writeMaidProp(writer, version, data) {
		writer.writeString('CM3D2_MPROP');
		writer.writeInt32(version);
		writer.writeInt32(data.idx);
		writer.writeString(data.name);
		writer.writeInt32(data.type);
		writer.writeInt32(data.valueDefault);
		writer.writeInt32(data.value);
		writer.writeInt32(data.tempValue);
		writer.writeInt32(data.valueLinkMax);
		writer.writeString(data.fileName);
		writer.writeInt32(data.fileNameRid);
		writer.writeBoolean(data.dut);
		writer.writeInt32(data.max);
		writer.writeInt32(data.min);
	}

	function writePartsColor(writer, data) {
		writer.writeBoolean(data.use);
		writer.writeInt32(data.mainHue);
		writer.writeInt32(data.mainChroma);
		writer.writeInt32(data.mainBrightness);
		writer.writeInt32(data.mainConstrast);
		writer.writeInt32(data.shadowRate);
		writer.writeInt32(data.shadowHue);
		writer.writeInt32(data.shadowChroma);
		writer.writeInt32(data.shadowBrightness);
		writer.writeInt32(data.shadowContrast);
	}

	function writeMaidParts(writer, version, data) {
		writer.writeString('CM3D2_MULTI_COL');
		writer.writeInt32(version);
		writer.writeInt32(data.length);
		for (var i = 0; i < data.length; i++) {
			writePartsColor(writer, data[i]);
		}
	}

	function writeMaidParam(writer, version, data) {
		writer.writeString('CM3D2_MAID_PPARAM');
		writer.writeInt32(version);

		writer.writeString(data.guid);
		writer.writeString(data.createTime);
		writer.writeInt64(data.createTimeNum);
		writer.writeInt32(data.employmentDay);
		writer.writeInt32(data.maidPoint);
		writer.writeString(data.lastName);
		writer.writeString(data.firstName);
		writer.writeString(data.profile);
		writer.writeString(data.freeComment);
		writer.writeInt32(data.initSeikeiken);
		writer.writeInt32(data.seikeiken);
		writer.writeInt32(data.personal);
		writer.writeInt32(data.contractType);

		writer.writeInt32(data.maidClassData.length);
		for (var i = 0; i < data.maidClassData.length; i++) {
			writer.writeBoolean(data.maidClassData[i].have);
			writeExperience(writer, data.maidClassData[i].exp);
		}

		writer.writeInt32(data.currentMaidClass);

		writer.writeInt32(data.yotogiClassData.length);
		for (var i = 0; i < data.yotogiClassData.length; i++) {
			writer.writeBoolean(data.yotogiClassData[i].have);
			writeExperience(writer, data.yotogiClassData[i].exp);
		}

		writer.writeInt32(data.currentYotogiClass);

		writer.writeInt32(data.feature.length);
		for (var i = 0; i < data.feature.length; i++) {
			writer.writeInt32(data.feature[i]);
		}

		writer.writeInt32(data.propensity.length);
		for (var i = 0; i < data.propensity.length; i++) {
			writer.writeInt32(data.propensity[i]);
		}

		writer.writeInt32(data.body.height);
		writer.writeInt32(data.body.weight);
		writer.writeInt32(data.body.bust);
		writer.writeInt32(data.body.waist);
		writer.writeInt32(data.body.hip);
		writer.writeString(data.body.cup);
		writer.writeInt32(data.condition);
		writer.writeInt32(data.conditionSpecial);
		writer.writeInt32(data.yotogiPlayCount);
		writer.writeInt32(data.othersPlayCount);
		writer.writeInt32(data.likability);
		writer.writeInt32(data.studyRate);
		writer.writeInt32(data.curHp);
		writer.writeInt32(data.hp);
		writer.writeInt32(data.curMind);
		writer.writeInt32(data.mind);
		writer.writeInt32(data.curReason);
		writer.writeInt32(data.reason);
		writer.writeInt32(data.reception);
		writer.writeInt32(data.care);
		writer.writeInt32(data.lovely);
		writer.writeInt32(data.inyoku);
		writer.writeInt32(data.elegance);
		writer.writeInt32(data.mValue);
		writer.writeInt32(data.charm);
		writer.writeInt32(data.hentai);
		writer.writeInt32(data.housi);
		writer.writeInt32(data.teachRate);
		writer.writeInt32(data.sexual.mouth);
		writer.writeInt32(data.sexual.throat);
		writer.writeInt32(data.sexual.nipple);
		writer.writeInt32(data.sexual.front);
		writer.writeInt32(data.sexual.back);
		writer.writeInt32(data.sexual.curi);
		writer.writeInt32(data.playNumber);
		writer.writeInt32(data.frustration);
		writer.writeInt32(data.popularRank);
		writer.writeInt64(data.evaluation);
		writer.writeInt64(data.totalEvaluation);
		writer.writeInt64(data.sales);
		writer.writeInt64(data.totalSales);
		writer.writeBoolean(data.isFirstNameCall);
		writer.writeBoolean(data.isRentalMaid);
		writer.writeInt32(data.noonWorkID);
		writer.writeInt32(data.nightWorkID);

		var keys = getKeys(data.skillData);
		writer.writeInt32(keys.length);
		for (var i = 0; i < keys.length; i++) {
			writer.writeInt32(keys[i]);
			var val = data.skillData[keys[i]];
			writer.writeInt32(val.id);
			writer.writeUInt32(val.playCount);
			writeExperience(writer, val.exp);
		}

		var keys = getKeys(data.workData);
		writer.writeInt32(keys.length);
		for (var i = 0; i < keys.length; i++) {
			writer.writeInt32(keys[i]);
			var val = data.workData[keys[i]];
			writer.writeInt32(val.id);
			writer.writeUInt32(val.playCount);
			writer.writeInt32(val.level);
		}

		var keys = getKeys(data.genericFlag);
		writer.writeInt32(keys.length);
		for (var i = 0; i < keys.length; i++) {
			writer.writeString(keys[i]);
			writer.writeInt32(data.genericFlag[keys[i]]);
		}

		writer.writeBoolean(data.employment);
		writer.writeBoolean(data.leader);
		writer.writeInt32(data.eyePartsTab);

		var keys = getKeys(data.partsDic);
		writer.writeInt32(keys.length);
		for (var i = 0; i < keys.length; i++) {
			writer.writeString(keys[i]);
			writer.writeString(data.partsDic[keys[i]]);
		}

		writer.writeInt32(data.maidClassBonusStatus.hp);
		writer.writeInt32(data.maidClassBonusStatus.mind);
		writer.writeInt32(data.maidClassBonusStatus.reception);
		writer.writeInt32(data.maidClassBonusStatus.care);
		writer.writeInt32(data.maidClassBonusStatus.lovely);
		writer.writeInt32(data.maidClassBonusStatus.inyoku);
		writer.writeInt32(data.maidClassBonusStatus.elegance);
		writer.writeInt32(data.maidClassBonusStatus.mValue);
		writer.writeInt32(data.maidClassBonusStatus.charm);
		writer.writeInt32(data.maidClassBonusStatus.hentai);
		writer.writeInt32(data.maidClassBonusStatus.housi);
		writer.writeInt32(data.maidClassBonusStatus.teachRate);

		writer.writeInt32(1923480616);
	}

	function writeBinaryData(writer, data) {
		data = Uint8Array.fromBase64(data);
		writer.writeInt32(data.byteLength);
		for (var i = 0; i < data.byteLength; i++) {
			writer.writeByte(data[i]);
		}
	}

	function writeMaidMisc(writer, version, data) {
		writer.writeString('CM3D2_MAID_MISC');
		writer.writeInt32(version);
		writer.writeInt32(data.activeSlotNo);
		writeBinaryData(writer, data.texIcon);
		writer.writeString(data.thumbCardTime);
		writeRGBA(writer, data.colorMan);
	}

	function writeMaidProps(writer, version, data) {
		writer.writeString('CM3D2_MPROP_LIST');
		writer.writeInt32(version);

		var keys = getKeys(data);
		writer.writeInt32(keys.length);
		for (var i = 0; i < keys.length; i++) {
			writer.writeString(keys[i]);
			writeMaidProp(writer, version, data[keys[i]]);
		}
	}

	function writePlayerParam(writer, version, data) {
		writer.writeString('CM3D2_PPARAM');
		writer.writeInt32(version);

		writer.writeString(data.playerName);
		writer.writeInt32(data.scenarioPhase);
		writer.writeInt32(data.phaseDays);
		writer.writeInt32(data.days);
		writer.writeInt64(data.shopUseMoney);
		writer.writeInt64(data.money);
		writer.writeInt64(data.initSalonLoan);
		writer.writeInt64(data.salonLoan);
		writer.writeInt32(data.salonClean);
		writer.writeInt32(data.salonBeautiful);
		writer.writeInt32(data.salonEvaluation);
		writer.writeBoolean(data.isFirstNameCall);
		writer.writeInt32(data.currentSalonGrade);
		writer.writeInt32(data.bestSalonGrade);

		for (var i = 0; i < 6; i++) {
			var schedule = data.scheduleSlots[i];

			writer.writeString(schedule.maidGuid);
			writer.writeInt32(schedule.noonSuccessLevel);
			writer.writeInt32(schedule.nightSuccessLevel);
			writer.writeBoolean(schedule.communication);

			var keys = getKeys(schedule.backupStatusDic);
			writer.writeInt32(keys.length);
			for (var j = 0; j < keys.length; j++) {
				writer.writeString(keys[j]);
				writer.writeInt32(schedule.backupStatusDic[keys[j]]);
			}
		}

		var keys = getKeys(data.genericFlag);
		writer.writeInt32(keys.length);
		for (var i = 0; i < keys.length; i++) {
			writer.writeString(keys[i]);
			writer.writeInt32(data.genericFlag[keys[i]]);
		}

		var keys = getKeys(data.nightWorksStateDic);
		writer.writeInt32(keys.length);
		for (var i = 0; i < keys.length; i++) {
			writer.writeInt32(keys[i]);
			var val = data.nightWorksStateDic[keys[i]];
			writer.writeInt32(val.workId);
			writer.writeString(val.calledMaidGuid);
			writer.writeBoolean(val.finish);
		}

		var keys = getKeys(data.shopLineupDic);
		writer.writeInt32(keys.length);
		for (var i = 0; i < keys.length; i++) {
			writer.writeInt32(keys[i]);
			writer.writeInt32(data.shopLineupDic[keys[i]]);
		}

		var keys = getKeys(data.haveItemList);
		writer.writeInt32(keys.length);
		for (var i = 0; i < keys.length; i++) {
			writer.writeString(keys[i]);
			writer.writeBoolean(data.haveItemList[keys[i]]);
		}

		writer.writeInt32(data.haveTrophyList.length);
		for (var i = 0; i < data.haveTrophyList.length; i++) {
			writer.writeInt32(data.haveTrophyList[i]);
		}

		writer.writeInt32(data.maidClassOpenFlag.length);
		for (var i = 0; i < data.maidClassOpenFlag.length; i++) {
			writer.writeInt32(data.maidClassOpenFlag[i]);
		}

		writer.writeInt32(data.yotogiClassOpenFlag.length);
		for (var i = 0; i < data.yotogiClassOpenFlag.length; i++) {
			writer.writeInt32(data.yotogiClassOpenFlag[i]);
		}

		writer.writeInt32(348195810);
	}

	function writeSaveData(data) {
		var writer = new BinaryWriter();
		writer.writeString('CM3D2_SAVE');
		writer.writeInt32(data.version);

		writer.writeString(data.header.saveTime);
		writer.writeInt32(data.header.gameDay);
		writer.writeString(data.header.playerName);
		writer.writeInt32(data.header.maidNum);
		writer.writeString(data.header.comment);

		writer.writeString('CM3D2_CHR_MGR');
		writer.writeInt32(data.version);

		writePlayerParam(writer, data.version, data.chrMgr.playerParam);

		writer.writeInt32(data.chrMgr.stockMan.length);
		for (var i = 0; i < data.chrMgr.stockMan.length; i++) {
			writeMaidProps(writer, data.version, data.chrMgr.stockMan[i].props);
			writeMaidMisc(writer, data.version, data.chrMgr.stockMan[i].misc);
		}

		writer.writeInt32(data.chrMgr.stockMaid.length);
		for (var i = 0; i < data.chrMgr.stockMaid.length; i++) {
			writeMaidProps(writer, data.version, data.chrMgr.stockMaid[i].props);
			writeMaidParts(writer, data.version, data.chrMgr.stockMaid[i].parts);
			writeMaidParam(writer, data.version, data.chrMgr.stockMaid[i].param);
			writeMaidMisc(writer, data.version, data.chrMgr.stockMaid[i].misc);
		}

		writer.writeString('CM3D2_SCRIPT');
		writer.writeInt32(data.version);
		writer.writeString('CM3D2_KAG');
		writer.writeInt32(data.version);
		writeBinaryData(writer, data.script.kag);
		writer.writeBoolean(data.script.fadeWait);
		writer.writeBoolean(data.script.enabled);

		return writer.getBuffer();
	}

	exports.parseSaveData = parseSaveData;
	exports.writeSaveData = writeSaveData;
})(window || exports);