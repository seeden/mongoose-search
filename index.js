'use strict';

function createBasicSchema(parentSchema, field) {
	return {
		type: "object",
		properties: {},
		required: [],
		additionalProperties: false,

		field: field,
		path: (parentSchema && parentSchema.path) 
			? parentSchema.path + '.' + field 
			: field
	};
}

function parseMongoosePath(parentSchema, path) {
	if(!parentSchema) {
		throw new Error('Parent schema is undefined');
	}

	var parts = path.split('.');

	for(var i=0; i<parts.length-1; i++) {
		var properties = parentSchema.properties;
		var field = parts[i];

		if(properties[field]) {
			parentSchema = properties[field];
			continue;
		}

		properties[field] = createBasicSchema(parentSchema, field);
		parentSchema = properties[field];
	}

	return parentSchema;
}

function createPureFieldSchema(type, options, isStrict) {
	options = options || {};

	var schema = {};
	if(isStrict) {
		schema.type = type;
		return schema;
	}

	var oneOf = schema.oneOf = [];

	if(options.equal !== false) {
		oneOf.push({ type: type });
	}

	if(options.equalStrict) {
		return schema;
	}

	var obj = { type: 'object' };
	var props = obj.properties = {};
	var anyOf = obj.anyOf = [];

	oneOf.push(obj);

	return schema;
}

function parseMongooseType(schema, type, options, isStrict) {
	var json = null;

	if(type === false) {
		return json;
	} else if(type === String) {
		json = createStringJSONSchema(options.search, isStrict);
	} else if(type === Boolean) {
		json = createBooleanJSONSchema(options.search, isStrict);
	} else if(type === schema.constructor.Types.ObjectId) {
		json = createStringJSONSchema(options.search, isStrict);
	} else if(type === schema.constructor.Types.Mixed) {
		json = {};
	} else if(type === Number) {
		json = createNumberJSONSchema(options.search, isStrict);
	} else if(type === Date) {
		json = createStringJSONSchema(options.search, isStrict);
	} else if(Array.isArray(type)) {
		var itemType = type.length ? type[0] : schema.constructor.Types.Mixed;
		var itemOptions = itemType.type ? itemType : { type: itemType };
		itemType = itemType.type ? itemType.type : itemType;

		if(isStrict) {
			var itemJSON = parseMongooseType(schema, itemType, itemOptions, isStrict);
			if(!itemJSON) {
				return;
			}

			return {
				type: 'array',
				item: itemJSON
			};
		}

		return parseMongooseType(schema, itemType, itemOptions, isStrict);
	} else if(typeof type === 'object' && type !== null) {
		//when user will use schema.path('name', subschema);
		console.log('Objects are not handled by mongoose search', type, options);
	} else {
		console.log('This type is not handled by mongoose search ', type, options);
	}

	return json;
}

function parseMongooseSchema(schema, excludeFn, mainSchema, parentSchema) {
	mainSchema = mainSchema || createBasicSchema();
	parentSchema = parentSchema || mainSchema;
	excludeFn = excludeFn || defaultExcludeFn;

	schema.eachPath(function(path, config) {
		var currentSchema = parseMongoosePath(parentSchema, path);
		var type = config.options.type;
		var caster = config.caster || {};
		var options = caster.options || config.options || {};
		var fieldName = path.split('.').pop();


		if(excludeFn(currentSchema.path, options)) {
			return;
		}

		//parse nested schema
		if(config.schema) {
			//only arrays can handle nested schemas
			if(!Array.isArray(type)) {
				throw new Error('Type must be array. Rewrite mongoose-search plugin')
			}

			currentSchema.properties[fieldName] = {
				type: 'array',
				item: createBasicSchema(currentSchema, fieldName)
			};

			parseMongooseSchema(config.schema, excludeFn, mainSchema, currentSchema.properties[fieldName].item);
			return;
		}

		var fieldSchema = parseMongooseType(schema, type, options, false);
		var fieldSchemaStrict = parseMongooseType(schema, type, options, true);
		if(!fieldSchema || !fieldSchemaStrict) {
			return;
		}

		var isSubdocument = mainSchema !== currentSchema;

		if(isSubdocument) {
			currentSchema.properties[fieldName] = fieldSchemaStrict;

			//subdocuments has required all properties
			currentSchema.required.push(fieldName);

			//allow searching by one subfield
			var fieldPath = currentSchema.path + '.' + fieldName;
			mainSchema.properties[fieldPath] = fieldSchema;
		} else {
			currentSchema.properties[fieldName] = fieldSchema;
		}
	});

	if(mainSchema !== parentSchema) {
		return parentSchema;
	}

	var properties = parentSchema.properties;


	//prepare geo search
	var indexes = schema.indexes();
	var parsedIndexes = [];
	var hasTextIndex = false;

	for(var i=0; i<indexes.length; i++) {
		var index = indexes[i];
		var field = index[0];
		var options = index[1] || {};

		if(typeof field === 'string') {
			parsedIndexes.push({
				path: field,
				type: options.type,
				options: options,
				field: field
			});
		} else {
			Object.keys(field).forEach(function (path) {
				var type = field[path];

				parsedIndexes.push({
					path: path,
					type: field[path],
					options: options,
					field: field
				});
			});
		}
	}

	for(var i=0; i<parsedIndexes.length; i++) {
		var parsedIndex = parsedIndexes[i];

		if(parsedIndex.type!=='text') {
			hasTextIndex = true;
		}

		if(parsedIndex.type!=='2dsphere') {
			continue;
		}

		var path = parsedIndex.path;
		var property = properties[path];
		var geoSearch = {
			type: 'object',
			properties: {},
			anyOf: []
		};

		addGeoOperators(geoSearch);

		properties[path] = {
			oneOf: [geoSearch]
		};

		if(property) {
			properties[path].oneOf.push(property);
		}
	}

	if(hasTextIndex) {
		properties['$text'] = { 
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
	}

	return parentSchema;
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

function addElementOperators(obj, options) {
	return;
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
/*
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
	}*/

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

function createNumberJSONSchema(options, isStrict, isArray) {
	var schema = createPureFieldSchema('number', options, isStrict);

	if(isStrict) {
		return schema;
	}

	var oneOfLength = schema.oneOf.length;
	var obj = schema.oneOf[oneOfLength-1];

	addComparisonOperators('number', obj, options);
	addElementOperators(obj, options);

	if(isArray) {
		addArrayOperators('boolean', obj, options);
	}

	return schema;
}

function createStringJSONSchema(options, isStrict, isArray) {
	var schema = createPureFieldSchema('string', options, isStrict);

	if(isStrict) {
		return schema;
	}

	var oneOfLength = schema.oneOf.length;
	var obj = schema.oneOf[oneOfLength-1];

	addComparisonOperators('string', obj, options);
	addElementOperators(obj, options);
	addTextSearchOperators(obj, options);

	if(isArray) {
		addArrayOperators('boolean', obj, options);
	}

	return schema;
}

function createBooleanJSONSchema(options, isStrict, isArray) {
	var schema = createPureFieldSchema('boolean', options, isStrict);

	if(isStrict) {
		return schema;
	}

	var oneOfLength = schema.oneOf.length;
	var obj = schema.oneOf[oneOfLength-1];

	addComparisonOperators('boolean', obj, options);
	addElementOperators(obj, options);

	if(isArray) {
		addArrayOperators('boolean', obj, options);
	}

	return schema;
}


function addGeoOperators(obj, options) {
	options = options || {};

	var props = obj.properties;
	var anyOf = obj.anyOf;

	var geoWithin = null;

	if(options.geoWithin !== false) {
		geoWithin = props['$geoWithin'] = {};
		anyOf.push({ 'required': ['$geoWithin'] });
	}

	if(options.geoWithinGeometry !== false) {
		geoWithin['$geometry'] = {
			type: 'object', 
			properties: {
				type: {
					enum: ['Polygon', 'MultiPolygon']
				},
				coordinates: {
					type: 'array'
				}

			}
			
		};
	}
}