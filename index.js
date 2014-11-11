'use strict';


function parseMongoosePath(path, schema) {
	path = path || '';

	schema = schema || {
		type: "object",
		properties: {},
		required: [],
		additionalProperties: false
	};

	var parts = path.split('.'),
		properties = schema.properties;

	for(var i=0; i<parts.length-1; i++) {
		var part = parts[i];

		if(!properties[part]) {
			properties[part] = {
				type: "object",
				properties: {},
				required: [],
				additionalProperties: false
			};
		}

		schema = properties[part];
	}

	return schema;
}


function addElementOperators(obj, options) {
	options = options || {};

	var props = obj.properties,
		anyOf = obj.anyOf;

	if(options.exists !== false) {
		props['$exists'] = { type: 'boolean' };
		anyOf.push({ 'required': ['$exists'] });
	}

	if(options.type !== false) {
		props['$type'] = { enum: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, -1, 255, 127] };
		anyOf.push({ 'required': ['$type'] });
	}	
}

function addArrayOperators(obj, type, options) {
	options = options || {};

	var props = obj.properties,
		anyOf = obj.anyOf;

	if(options.all !== false) {
		props['$all'] = { 
			type: 'array',
			minItems: 1,
			items: {
				type: type
			}
		};

		anyOf.push({ 'required': ['$all'] });
	}

	if(options.size !== false) {
		props['$size'] = { type: 'number' };
		anyOf.push({ 'required': ['$size'] });
	}
}

var lgs = ['none', 'danish', 'dutch', 'english', 'finnish', 
	'french', 'german', 'hungarian', 'italian', 
	'norwegian', 'portuguese', 'romanian', 'russian', 
	'spanish', 'swedish', 'turkish'];

function addTextSearchOperators(obj, options) {
	options = options || {};

	var props = obj.properties,
		anyOf = obj.anyOf;

	if(options.text !== false) {
		props['$text'] = { 
			type: 'object',
			properties: {
				"$search": {
					type: "string"
				},
				"$language": {
					enum: lgs
				} 
			},
			required: ['$search']
		};

		anyOf.push({ 'required': ['$text'] });
	}

	if(options.regex !== false) {
		props['$regex'] = { type: 'string' };
		anyOf.push({ 'required': ['$regex'] });
	}

	if(options.options !== false) {
		props['$options'] = { type: 'string' };
		anyOf.push({ 'required': ['$options'] });
	}
}


function addComparisonOperators(type, obj, options) {
	options = options || {};

	var props = obj.properties,
		anyOf = obj.anyOf;

	if(options.lte !== false) {
		props['$lte'] = { type: type };
		anyOf.push({ 'required': ['$lte'] });
	}

	if(options.lt !== false) {
		props['$lt'] = { type: type };
		anyOf.push({ 'required': ['$lt'] });
	}

	if(options.gte !== false) {
		props['$gte'] = { type: type };
		anyOf.push({ 'required': ['$gte'] });
	}

	if(options.gt !== false) {
		props['$gt'] = { type: type };
		anyOf.push({ 'required': ['$gt'] });
	}

	if(options.ne !== false) {
		props['$ne'] = { type: type };
		anyOf.push({ 'required': ['$ne'] });
	}

	if(options.in !== false) {
		props['$in'] = { 
			type: 'array',
			minItems: 1,
			items: {
				type: type
			}
		};

		anyOf.push({ 'required': ['$in'] });
	}

	if(options.nin !== false) {
		props['$nin'] = { 
			type: 'array',
			minItems: 1,
			items: {
				type: type
			}
		};

		anyOf.push({ 'required': ['$nin'] });
	}
}


function createPureFieldSchema(type, options) {
	options = options || {};

	var schema = {},
		oneOf = schema.oneOf = [];

	if(options.equal !== false) {
		oneOf.push({ type: type });
	}

	if(options.equalStrict) {
		return schema;
	}

	var obj = { type: 'object' },
		props = obj.properties = {},
		anyOf = obj.anyOf = [];

	oneOf.push(obj);

	return schema;
}

function createNumberJSONSchema(options, isArray) {
	var schema = createPureFieldSchema('number', options),
		oneOfLength = schema.oneOf.length,
		obj = schema.oneOf[oneOfLength-1];

	addComparisonOperators('number', obj, options);
	addElementOperators(obj, options);

	if(isArray) {
		addArrayOperators('boolean', obj, options);
	}

	return schema;
}

function createStringJSONSchema(options, isArray) {
	var schema = createPureFieldSchema('string', options),
		oneOfLength = schema.oneOf.length,
		obj = schema.oneOf[oneOfLength-1];

	addComparisonOperators('string', obj, options);
	addElementOperators(obj, options);
	addTextSearchOperators(obj, options);

	if(isArray) {
		addArrayOperators('boolean', obj, options);
	}

	return schema;
}

function createBooleanJSONSchema(options, isArray) {
	var schema = createPureFieldSchema('boolean', options),
		oneOfLength = schema.oneOf.length,
		obj = schema.oneOf[oneOfLength-1];

	addComparisonOperators('boolean', obj, options);
	addElementOperators(obj, options);

	if(isArray) {
		addArrayOperators('boolean', obj, options);
	}

	return schema;
}


function parseMongooseType(schema, type, options) {
	var json = {};

	if(type === String) {
		json = createStringJSONSchema(options.search);
	} else if(type === Boolean) {
		json = createBooleanJSONSchema(options.search);
	} else if(type === schema.constructor.Types.ObjectId) {
		json = createStringJSONSchema(options.search);
	} else if(type === Number) {
		json = createNumberJSONSchema(options.search);
	} else if(type === Date) {
		json = createStringJSONSchema(options.search);
	} else if(Array.isArray(type)) {
		//process array item
		var itemType = type.length ? type[0] : schema.constructor.Types.Mixed;
		var itemOptions = itemType.type ? itemType : { type: itemType };

		itemType = itemType.type ? itemType.type : itemType;

		return parseMongooseType(schema, itemType, itemOptions, true);
	} else if(typeof type === 'object' && type !== null) {
		
	} else {
		json = createStringJSONSchema(options.search);
	}

	return json;
}

function parseMongooseSchema(schema, excludeFn) {
	var jsonSchema = parseMongoosePath();

	excludeFn = excludeFn || defaultExcludeFn;

	schema.eachPath(function(path, config) {
		var localJSONSchema = parseMongoosePath(path, jsonSchema),
			field = path.split('.').pop(),
			type = config.options.type,
			caster = config.caster || {},
			options = caster.options || config.options || {};

		if(excludeFn(path, options)) {
			return;
		}

		var fieldValue = null;

		if(config.schema) {
			if(Array.isArray(type)) {
				fieldValue = parseMongooseType(schema, type, options, true);
				fieldValue.items = parseMongooseSchema(config.schema, excludeFn);
			} else {
				fieldValue = parseMongooseSchema(config.schema, excludeFn);	
			}
		} else {
			fieldValue = parseMongooseType(schema, type, options);
		}

		if(!fieldValue) {
			return;
		}

		localJSONSchema.properties[field] = fieldValue;
	});

	return jsonSchema;
}

function defaultExcludeFn(path, options) {
	var optionsSearch = options.search || {};

	if(optionsSearch.exclude) {
		return true;
	}

	return false;
}

module.exports = function mongooseJSONSchema (schema, options) {
	//prepare arguments
	options = options || {};

	options.excludeFn = options.excludeFn || defaultExcludeFn;

	schema.methods.getSearchSchema = function(excludeFn) {
		return parseMongooseSchema(schema, excludeFn || options.excludeFn);
	};

	schema.statics.getSearchSchema = schema.methods.getSearchSchema;	
};