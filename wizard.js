function maWizardConstructor() {
	var dataContext;
	var dataContextDep = new Deps.Dependency;

	var onSaveFailure;
	var onSaveFailureDep = new Deps.Dependency();

	var collection;
	var schema;
	var collectionDefs;

	var validationContext;

	var activeFields;
	var template;
	var isModal;
	var initializedTemplates = [];
	var self = this;

	/**
	 * Returns a default value whose type is coherent with respect to the
	 * 'key' data type reported in the schema
	 * @param  {String} key - Key for the schema field of interest
	 */
	var getDefaultValue = function(key) {
		var keyType = schema.schema(key).type();

		// for numbers an empty string is returned and the clean() method
		// will perform the appropriate normalization
		if(typeof keyType === 'string' || typeof keyType === 'number')
			return "";
		else if(typeof keyType === 'boolean')
			return false;
		else if(Array.isArray(keyType))
			return [];
	};

	var loadFromDatabase = function(id) {
		// if no id is specified I am adding a new object
		if(id === undefined)
			return self.buildObjectFromSchema();
		else
			return collection.findOne(id);
	};

	/**
	 * Returns an object whose structure is specified by the schema passed
	 * to init(). All keys have default value
	 */
	this.buildObjectFromSchema = function() {
		var obj = {};

		_.each(schema.objectKeys(), function(key) {
			obj[key] = getDefaultValue(key);
		});

		obj["_id"] = undefined;

		return obj;
	};

	/**
	 * Set the data context and invalidates getDataContext() computations
	 * @param  {Object} context - New data context
	 */
	this.setDataContext = function(context) {
		dataContext = context;
		dataContextDep.changed();
	};

	/**
	 * Reactively gets the data context
	 */
	this.getDataContext = function() {
		dataContextDep.depend();
		return dataContext;
	};

	/**
	 * Gets the maSimpleSchema validation context.
	 */
	this.getValidationContext = function() {
		return validationContext;
	};

	/**
	 * If 'field' is specified, returns the SimpleSchema field definition.
	 * With no parameter it returns the whole SimpleSchema definition. 
	 * @param  {String} [field] - SimpleSchema field name
	 */
	this.getSchemaObj = function(field) {
		// field could be undefined, case in which the whole schema
		// object is returned
		if(schema)
			return schema.schema(field);

		return undefined;
	};

	/**
	 * Gets the used maSimpleSchema object.
	 */
	this.getSchema = function() {
		return schema;
	};

	/**
	 * Returns true if the specified field is active (this means it is shown when using standard components).
	 * @param  {String} field - SimpleSchema field name
	 */
	this.isFieldActive = function(field) {
		// if the field is of the type mainField.N.field we
		// must replace the number N with $
		var normField = field.replace(/\.\d\./, ".$.");
		
		if(activeFields) {
			if(activeFields.indexOf(normField) > -1)
				return true;
			else
				return false;
		}

		return true;
	};

	/**
	 * Returns an array containing all active fields (those shown when using standard components).
	 */
	this.getActiveFields = function() {
		return activeFields;
	};

	this.isModal = function() {
		if(isModal)
			return true;
		else
			return false;
	};

	this.getTemplateName = function() {
		return template;
	};

	/**
	 * Returns a FieldValuePair object to use with other maWizard methods.
	 * @param  {String} field - SimpleSchema field name
	 * @param  {*} - Field value
	 */
	this.buildFieldValuePair = function(field, value) {
		return new FieldValuePair(field, value);
	};

	/**
	 * Extracts the field to which the HTML element is linked (specified by
	 * the `data-schemafield` attribute) and the displayed value. Returns a
	 * FieldValuePair containing such information.
	 * The 'elem' param should represents a text input, textarea, checkbox,
	 * select or multiselect element.
	 * @param  {Object} elem - HTML DOM element
	 */
	this.parseHTMLElement = function(elem) {
		// extracting field name from data-schemafield attribute
		var field = elem.getAttribute('data-schemafield');
		var inputType = elem.type;

		// if the input is a checkbox we want to get its checked state,
		// for a multiple select we want the selected elements and for 
		// the other inputs we simply get the value
		var value;
		if(inputType === "checkbox")
			value = elem.checked;
		else if(inputType === "select-multiple") {
			var ops = _.filter(elem.options, function(elem) {
				if(elem.selected)
					return true;
			});
			value = _.map(ops, function(elem) {
				return elem.value;
			});
		}
		else value = elem.value;

		// constructing the object to pass to validateOne(obj, key)
		var fieldValuePair = this.buildFieldValuePair(field, value);
		
		return fieldValuePair;
	};

	/**
	 * Calls parseHTMLElem() on 'elem' and saves the returned
	 * FieldValuePair in the data context
	 * @param  {Object} elem - HTML DOM element
	 */
	this.saveHTMLElement = function(elem) {
		var toSave = this.parseHTMLElement(elem);

		this.processFieldValuePair(toSave);
	};

	/**
	 * Validates 'fieldValuePair' and saves the content in the
	 * data context. The save is performed even if data are invalid 
	 * @param  {FieldValuePair} fieldValuePair - Field/value to store in data context
	 */
	this.processFieldValuePair = function(fieldValuePair) {
		var field = fieldValuePair.getFieldName();
		var value = fieldValuePair.getValue();
		
		var plainObj = {};
		plainObj[field] = value;

		// clean the object "to avoid any avoidable validation errors" 
		// [cit. aldeed - Simple-Schema author]
		schema.clean(plainObj, {removeEmptyStrings: false});

		// update the data context
		this.updateContext(plainObj);

		// passing the whole dataContext but validating just the right field,
		// we perform the validation we want being able to deal with dependencies
		validationContext.validateOne(dataContext, field);
	};

	/**
	 * Validates the data context. If the validation is successful, it creates a new entry
	 * in the database to store the data context and add the MongoDB _id of the document to
	 * the data context. If the validation is not successful, it returns false
	 */
	this.create = function() {
		// return a feedback about validation and database errors

		var data = this.getDataContext();

		// the clean method performs useful operations to avoid
		// tricky validation errors (like conversion of String 
		// to Number when it is meaningful)
		schema.clean(data);

		if(validationContext.validate(data)) {
			var id = collection.insert(data, function(error, result) {
				if(error !== undefined)
					console.log("Error on insert", error);
			});

			data["_id"] = id;
			this.setDataContext(data);
		}
		else return false;
	};

	/**
	 * Update the data context with data provided by 'newData'
	 * @param  {Object} newData - Data to store in the data context. The object structure should follow the schema definitions
	 */
	this.updateContext = function(newData) {
		var current = dataContext;

		var resetField = function(key) {
			current[key] = getDefaultValue(key);
		};

		// apply changes to current object
		for(var field in newData) {

			var dotIndex = field.indexOf(".");

			if(dotIndex > -1 && field[dotIndex + 2] === '.') {
				// we are dealing with a field of the type 'mainField.$.customField',
				// which is a field of a custom object saved in an array named mainField
				var mainField = field.substring(0, dotIndex);
				var index = field.substr(dotIndex + 1,1);
				var customField = field.substring(dotIndex + 3);

				// the corresponding object must already exist in the 
				// data context, so I just assign the new value
				current[mainField][index][customField] = newData[field];

			} // following if condition is too long, refactor
			else if(_.contains(schema.objectKeys(), field) && Array.isArray(schema.schema(field).type()) && !Array.isArray(newData[field])) {
				// If for the current field the schema expects an array of objects 
				// but a single object is passed, I add the object to the current array
				var elems = [];
				if(current[field] !== undefined)
					// use .slice() to achieve deep copy
					elems = current[field].slice(0);
				elems.push(newData[field]);
				current[field] = elems;
			}
			else current[field] = newData[field];

			// check for dependencies
			var deps = this.getSchema().getDefinition(field).maDependencies;
			if(deps) {
				_.each(deps, resetField);
			}
		}

		// save the modified object
		this.setDataContext(current);
	};

	/**
	 * Validates the data context. If the validation is successful, writes the data context to database.
	 * If the validation is not successful, it returns false.
	 * This should be called after a create() has already been called somewhere in the past.
	 */
	this.saveToDatabase = function() {
		var current = this.getDataContext();

		if(current._id === undefined)
			return "It seems like a .create() has never been called!";

		// up-to-date data are already in the dataContext variable, just validate
		// the entire object without the _id field
		var toSave = _.omit(current, '_id');

		validationContext.resetValidation();
		// usual clean
		schema.clean(toSave);
		validationContext.validate(toSave);

		if(validationContext.invalidKeys().length > 0)
			return false;
		else
			return collection.update(current._id, {$set: toSave}, function(error, result) {
				if(error)
					console.log("Error on save", error);
				// something went wrong... 
				// TODO: add a callback that saves the datacontext in order not
				// to lose changes
			});
	};

	/**
	 * Remove the current document from database. Note: The data context is not touched, so you have to reset manually with `maWizard.reset()` if needed
	 */
	this.removeFromDatabase = function() {
		var id = this.getDataContext()._id;
		//this.reset();
		return collection.remove(id, function(error, result) {
			console.log("Error on remove: " + error);
			console.log("Removed elements: " + result);
		});
	};

	/**
	 * Returns true if the data context is different from the document in database. False otherwise.
	 */
	this.hasChanged = function() {
		if(!this.getDataContext())
			return false;

		var inDatabase = collection.findOne({_id: this.getDataContext()._id});

		return inDatabase && !_.isEqual(inDatabase, this.getDataContext());
	};

	/**
	 * Set the data context to undefined and resets the validation context, plus some internal cleaning
	 */
	this.reset = function() {
		// TODO: remove orphan attachments files!!!
		this.setDataContext(undefined);
		validationContext.resetValidation();

		activeFields = undefined;
		template = undefined;
		isModal = undefined;
	};

	/**
	 * Reload the data context from database, overwriting eventual changes
	 */
	this.discard = function() {
		var current = this.getDataContext();
		if(current)
			this.setDataContext(loadFromDatabase(current._id));

		validationContext.resetValidation();
	};

	/**
	 * Initializes the maWizard object.
	 * If conf.collection is not specified, an error is thrown.
	 * If conf.schema is not specified, it expects to find a SimpleSchema object attached to the collection with .attachSchema().
	 * If conf.baseRoute is not specified, the root of the website ("/") is specified as baseRoute.
	 * If conf.template is not specified, events on elements with data-ma-wizard-* attributes should be handled manually.
	 * @param  {Object} conf - Configuration object
	 */
	this.init = function(conf) {
		var contextObj;

		collection = conf.collection;
		
		if(collection === undefined)
			throw "No collection defined for maWizard!";

		var defs;

		if(Schemas)
			defs = Schemas.findOne({definition: collection._name + "_definitions"});

		if(defs)
			activeFields = defs.visibleFields;
		else
			activeFields = undefined;

		if(conf.schema === undefined)
			schema = collection.simpleSchema();
		else
			schema = conf.schema;

		validationContext = schema.namedContext();

		if(conf.baseRoute === undefined)
			this.baseRoute = "";
		else
			this.baseRoute = conf.baseRoute;

		contextObj = loadFromDatabase(conf.id);

		this.setDataContext(contextObj);

		// could be undefined, true or false (undefined by default)
		isModal = conf.isModal;

		template = conf.template;

		// there's no way to unbind events attached to templates via Meteor APIs,
		// so I keep in memory which templates I have already initialized in order
		// not to add handlers more than once
		if(conf.template && (initializedTemplates.indexOf(conf.template) === -1)) {
			this.setStandardEventHandlers(conf.template);
			initializedTemplates.push(conf.template);
		}
	};

	/**
	 * Given a field, an array of the allowed values for that field is returned in the form of
	 * objects with label/value keys. Such values are taken from the maAllowedValues() function 
	 * defined in the schema definition. If the maAllowedValues function is not defined, values are
	 * taken from the allowedValues field and in this case the label is equal to the value.
	 * If allowedValues is also missing, an empty array is returned.
	 * This function is used by the templates providing the select and multiselect components.
	 * @param  {String} field - Name of the field of interest
	 */
	this.getSimpleSchemaAllowedValues = function(field) {
		var maAllowedValues = maWizard.getSchemaObj(field).maAllowedValues;
		var allowedValues = maWizard.getSchemaObj(field).allowedValues;

		if(maAllowedValues) {
			// maAllowedValues() requires a function that gets a key name
			// and returns its value as parameter
			var getKeyValue = function(field) {
				return maWizard.getDataContext()[field];
			};

			return maAllowedValues(getKeyValue);
		}

		if(allowedValues) {
			var toNormalize;

			if(typeof allowedValues === 'function')
				toNormalize = allowedValues();
			else
				toNormalize = allowedValues;

			return _.map(allowedValues, function(elem) {
				return {label: elem, value: label};
			});
		}

		return [];
	};

	/**
	 * Sets standard events handlers for standard components (those with data-ma-wizard-* attributes).
	 * The events are managed by Meteor.
	 * @param  {Object} templ - Template containing the standard components
	 */
	this.setStandardEventHandlers = function(templ) {
		var backToBase = function() {
			Router.go(maWizard.baseRoute);
		};

		Template[templ].events({
			'select2-selecting select': function(evt, templ) {
				var route;

				// if the current option has the `value` property formatted as
				// "route:routename" we want to navigate to `routename` and stop 
				// propagation of the event in order not to save the value to data context
				var parsed = evt.val.match(/route:(.+)/);
				if(parsed)
					route = parsed[1];

				// if `route` is undefined nothing is done so the `change` event
				// will be triggered
				if(route) {
					$('select[data-schemafield="' +
						evt.currentTarget.getAttribute("data-schemafield") +
						'"]'
					).select2("close");
					Router.go(route);
					evt.preventDefault();
				}
			},
			'change [data-ma-wizard-control]': function(evt, templ) {
				maWizard.saveHTMLElement(evt.currentTarget);
			},
			'click [data-ma-wizard-save]': function(evt, templ) {
				if(maWizard.saveToDatabase()) {
					Router.go(maWizard.baseRoute);
					maWizard.reset();
				}
				else {
					var onSaveFailure = maWizard.getOnSaveFailure();

					if(onSaveFailure === undefined || (typeof onSaveFailure !== "function")) {
						bootbox.alert("Cannot save to database! Check inserted data");
					}
					else onSaveFailure();
				}
			},
			'click [data-ma-wizard-ok]': backToBase,
			'click [data-ma-wizard-discard]': function(evt, templ) {
				maWizard.discard();
				backToBase();
			},
			'click [data-ma-wizard-back]': backToBase,
			'click [data-ma-wizard-create]': function(evt, templ) {
				if(maWizard.create())
					Router.go(maWizard.baseRoute + "/" + maWizard.getDataContext()._id);
			},
			'click [data-ma-wizard-delete]': function(evt,templ) {
				bootbox.confirm("Are you sure?", function(result) {
					if(result && maWizard.removeFromDatabase())
						Router.go(maWizard.baseRoute);
				});
			}
		});
	};

	/**
	 * Provide a function to execute after the data context has been written to database.
	 * This will override the standard behaviour, which consists in navigating to the baseRoute
	 * specified in the parameter of init() or navigating to the root if no baseRoute has been specified
	 * @param  {Function} callback - Function to execute after succesfully writing the data context to database
	 */
	this.setOnSaveFailure = function(callback) {
		onSaveFailure = callback;
		onSaveFailureDep.changed();
	};

	/**
	 * Reactively gets the `onSaveFailure` callback
	 **/
	this.getOnSaveFailure = function() {
		onSaveFailureDep.depend();
		return onSaveFailure;
	};
}

 /**
 * Data structure used by various methods of maWizard. It simply stores
 * key/value pairs providing getters for both field name and value.
 * @typedef {Object} FieldValuePair
 * @property {Function} getValue - Gets the set value
 * @property {Function} setValue - Sets value
 * @property {Function} getFieldName - Gets field name as String
 */
function FieldValuePair(field, value) {
	var _field = field;
	var _value = value;

	var _setValue = function(val) {
		_value = val;
	};

	this.getValue = function() { return _value; };
	this.setValue = function(val) {
		return _setValue(val);
	};

	this.getFieldName = function() { return _field; };
}

/**************** Template helpers *****************************************
 * Helpers used by maWizard templates. They are declared as global helpers
 * in order to be used by all the templates.
 * NOTE: all of these helpers directly reference the global maWizard object,
 * so no more then one maWizard instance can be used at a time (no multiple
 * wizards active together).
****************************************************************************/

UI.registerHelper('maWizardGetFieldValue', function(field) {
	var current = maWizard.getDataContext();
	// matches custom objects internal fields (mainFields.N.field)
	// and returns an array with the needed tokens
	var parsed = field.match(/(\w+)\.(\d)\.(\w+)/);
	
	if(current) {
		if(parsed) {
			return current[parsed[1]][parsed[2]][parsed[3]];
		}
		else return current[field];
	}
	else
		return "";
});

UI.registerHelper('maWizardGetFieldLabel', function(field) {
	try {
		return maWizard.getSchemaObj(field).label;
	}
	catch(e) {
		return "";
	}
});

// to use for String only, not for Number
UI.registerHelper('maWizardMaxLength', function(field) {
	var schema = maWizard.getSchemaObj();

	// if the field is of the type mainField.N.field we
	// must replace the number N with $
	var normField = field.replace(/\.\d\./, ".$.");
	try {
		if(schema && schema[normField]['max'])
			return schema[normField]['max'];
	}
	catch(e) {
		return -1;
	}
	
	return -1;
});

UI.registerHelper('maWizardFieldValidity', function(field) {
	if(field === undefined)
		return '';
	var validationResult = maWizard.getValidationContext().keyIsInvalid(field);
	if(validationResult)
		return 'has-error';
	else
		return '';
});

UI.registerHelper('maWizardErrMsg', function(field) {
	if(field === undefined)
		return '';
	var msg = maWizard.getValidationContext().keyErrorMessage(field);
	
	return msg;
});

UI.registerHelper('maWizardOptionIsSelected', function(field) {
	var current = maWizard.getDataContext();

	var value = this.value;

	// NOTE: current[field] could be either a String or an Array, in either case
	// the indexOf() method is defined and the result is the wanted behaviour
	if(current && current[field] && current[field].indexOf(value) > -1)
		return "selected";
	else return "";
});

UI.registerHelper('maWizardAllowedValuesFromSchema', function(field) {
	return maWizard.getSimpleSchemaAllowedValues(field);
});

UI.registerHelper('maWizardIsFieldActive', function(field) {
	return maWizard.isFieldActive(field);
});
/*****************************************************************************************/

// overriding the Router.go function in order not to lose changes in our wizards
// http://stackoverflow.com/questions/24367914/aborting-navigation-with-meteor-iron-router

var go = Router.go; // cache the original Router.go method

Router.go = function () {
	var self = this;
	var args = arguments;

	function customGo() {
		if(maWizard.isModal())
			$('#' + maWizard.getTemplateName() + ' .modal')
				.on('hidden.bs.modal', function() {
					go.apply(self, args);
				})
				.modal('hide');
		else go.apply(self, args);
	}
	
	if(maWizard.getDataContext() && maWizard.getDataContext()._id) {
		var saveResult = maWizard.saveToDatabase();
		if(typeof saveResult === 'string' || saveResult === false)
			bootbox.alert("Invalid data present. Please correct them or discard changes.");
		else {
			customGo();
			maWizard.reset();
		}
	}
	else customGo();
};

maWizard = new maWizardConstructor();
