var should = require('should'),
	request = require('supertest'),
	mongoose = require('mongoose'),
	Schema = mongoose.Schema,
	searchPlugin = require('../index');

var subCategory = exports.subCategory = {
	'STUDIO': 'STUDIO', 
	'2_STUDIO': '2_STUDIO',
	'1_ROOM_FLAT': '1_ROOM_FLAT',
	'2-ROOM-FLAT': '2-ROOM-FLAT',
	'3_ROOM_FLAT': '3_ROOM_FLAT',
	'4_ROOM_FLAT': '4_ROOM_FLAT',
	'5_ROOM_FLAT_MORE': '5_ROOM_FLAT_MORE',
	'MEZONET_FLAT': 'MEZONET_FLAT',
	'LOFT_FLAT': 'LOFT_FLAT',
	'OTHER_FLAT': 'OTHER_FLAT',
	'FAMILY_HOUSE': 'FAMILY_HOUSE',
	'VILLA_HOUSE': 'VILLA_HOUSE',
	'COUNTRY_HOUSE': 'COUNTRY_HOUSE',
	'GARDEN_COTTAGE_HOUSE': 'GARDEN_COTTAGE_HOUSE',
	'COTTAGE_HOUSE': 'COTTAGE_HOUSE',
	'OTHER_HOUSE': 'OTHER_HOUSE',
	'MANUFACTURAL_AREA': 'MANUFACTURAL_AREA',
	'WAREHOUSING_AREA': 'WAREHOUSING_AREA',
	'REPAIR_AREA': 'REPAIR_AREA',
	'ANIMAL_HUSBANDRY_AREA': 'ANIMAL_HUSBANDRY_AREA',
	'OTHER_OPERATING_AREA': 'OTHER_OPERATING_AREA',
	'FAMILY_HOUSE_PLOT': 'FAMILY_HOUSE_PLOT',
	'HOUSING_PROJECT_PLOT': 'HOUSING_PROJECT_PLOT',
	'RECREATION_PLOT': 'RECREATION_PLOT',
	'CIVIL_AMENITIES': 'CIVIL_AMENITIES',
	'COMMERTIAL_ZONE': 'COMMERTIAL_ZONE',
	'INDUSTRIAL_ZONE': 'INDUSTRIAL_ZONE',
	'MIXED_ZONE': 'MIXED_ZONE',
	'OTHER_BUILDING_PLOT': 'OTHER_BUILDING_PLOT',
	'GARDEN': 'GARDEN',
	'ORCHARD': 'ORCHARD',
	'MEADOW_GRASSLAND': 'MEADOW_GRASSLAND',
	'ARABLE_LAND': 'ARABLE_LAND',
	'HOP_FIELD_VINERY': 'HOP_FIELD_VINERY',
	'WOODLAND': 'WOODLAND',
	'WATER_AREA': 'WATER_AREA',
	'OTHER_AGRICURTURAL_PLOT': 'OTHER_AGRICURTURAL_PLOT'
};

describe('Model1', function() {
	var Model = null;

	it('should be able to connect', function(done) {
		mongoose.connect('mongodb://localhost/json-schema-test');
		done();
	});

	it('should be able to create model', function(done) {

		var schema2 = Schema({
			_id : false,
			pokus: { type: String }
		});

		var schema = new Schema({
			pokusik: [schema2],
			locc: {
				type        : { type: String },
				coordinates : []
			},
			subCategory     : { type: String, enum: Object.keys(subCategory), required: true },
			test: {
				fileName    : { type: Number, required: true },
				omg: {
					name: { type: String },
					hhh: [String]
				}
			},
			name        : { type: String, required: true, index: 'text', locale: true },
			company     : { type: Schema.ObjectId, ref: 'Company', required: true },
			price       : { type: Number, required: true, index: true },
			categories  : [ { type: Schema.ObjectId, ref: 'Category', uniqueItems: true } ],

			tags        : [String],
			tags2       : [{ type: String, uniqueItems: true }],
			images      : [{
				_id         : false,
				fileName    : { type: Number, required: true }
			}],

			

			images2      : {
				type: [{
					_id         : false,
					fileName    : { type: Number, required: true }
				}],
				minItems: 5,
				required: true
			},

			metadata   : [{
				_id   : false,
				key   : { type: String, required: true, minLength: 1 },
				value : { type: String, required: true, index: true }
			}],

			hasChild     : { type: Boolean, required: true }, 
		
			created 	 : { type: Date, default: Date.now }
		});

		schema.plugin(searchPlugin, {});


		schema.index('locc', {
			type: '2dsphere', 
			sparse: true
		});

		Model = mongoose.model('Model1', schema);

		done();
	});

	it('should be able to create json schema', function(done) {
		var schema = Model.getSearchSchema();
		var json = JSON.stringify(schema, null, 4);

		console.log(json);

		schema.should.have.property('additionalProperties');
		schema.additionalProperties.should.equal(false);

		done();
	});

	after(function(done) {
		done();
	});
});