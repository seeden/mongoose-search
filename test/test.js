var should = require('should'),
	request = require('supertest'),
	mongoose = require('mongoose'),
	Schema = mongoose.Schema,
	searchPlugin = require('../index');



describe('Model1', function() {
	var Model = null;

	it('should be able to connect', function(done) {
		mongoose.connect('mongodb://localhost/json-schema-test');
		done();
	});

	it('should be able to create model', function(done) {

		var schema = new Schema({
			/*test: {
				fileName    : { type: Number, required: true }
			},
			name        : { type: String, required: true, index: 'text', locale: true },
			company     : { type: Schema.ObjectId, ref: 'Company', required: true },
			price       : { type: Number, required: true, index: true },
			categories  : [ { type: Schema.ObjectId, ref: 'Category', uniqueItems: true } ],

			tags        : [String],
			tags2       : [{ type: String, uniqueItems: true }],*/
			images      : [{
				_id         : false,
				fileName    : { type: Number, required: true }
			}],
/*
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
				value : { type: String, required: true }
			}],

			hasChild     : { type: Boolean, required: true }, 
		
			created 	 : { type: Date, default: Date.now }*/
		});

		schema.plugin(searchPlugin, {});

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