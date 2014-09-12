function maWizardConstructor() {
	var dataContext;
	var dataContextDep = new Deps.Dependency;

	var onSaveFailure;
	var onSaveFailureDep = new Deps.Dependency();

	var collection;
	var schema;

	var validationContext;

	var isInDatabase;

	var initializedTemplates = [];

	// function set in the "custom" field of maSimpleSchema objects
	// to validate against maAllowedValues
	var customValidator = function() {
        var self = this;

        var contained = _.every(this.value, function(elem) {
			var ids = _.map(getSimpleSchemaAllowedValues(self.key), function(elem) {
				return elem.id.toString();
            });

            return ids.indexOf(elem) > -1;
        });

        if(contained) return true;
        else return "notAllowed";
    };

	var setCustomValidation = function() {
		var schemaObj = schema.schema();
		for(var fieldObj in schemaObj) {
			if(schemaObj[fieldObj].mawizard && schemaObj[fieldObj].mawizard.allowedValues) {
				schemaObj[fieldObj].custom = customValidator;
			}
		}
	};
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
	/**
	 * Returns an object whose structure is specified by the schema passed
	 * to init(). All keys have default value
	 */
	var buildObjectFromSchema = function() {
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

	this.getSchema = function() {
		return schema;
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
		// up-to-date data are already in the dataContext variable, just validate
		// the entire object without the _id field
		var toSave = _.omit(current, '_id');

		validationContext.resetValidation();
		// usual clean
		schema.clean(toSave, {removeEmptyStrings: false});
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
	 * Remove the current document from database.
	 */
	this.removeFromDatabase = function() {
		return collection.remove(this.getDataContext()._id, function(error, result) {
			console.log("Error on remove: " + error);
			console.log("Removed elements: " + result);
		});
	};

	/**
	 * Returns true if the data context is different from the document in database. False otherwise.
	 */
	this.hasChanged = function() {
		var inDatabase = collection.findOne({_id: this.getDataContext()._id});

		return inDatabase && !_.isEqual(inDatabase, this.getDataContext());
	};

	/**
	 * Set the data context to undefined and resets the validation context
	 */
	this.discard = function() {
		// TODO: remove orphan attachments files!!!
		this.setDataContext(undefined);
		validationContext.resetValidation();
	};

	/**
	 * Initializes the maWizard object.
	 * If conf.collection is not specified, an error is thrown.
	 * If conf.schema is not specified, it expects to find a SimpleSchema object attached to the collection with .attachSchema().
	 * If conf.baseRoute is not specified, baseRoute is specified as the root of the website.
	 * If conf.template is not specified, events on elements with data-ma-wizard-* attributes should be handled manually.
	 * @param  {Object} conf - Configuration object
	 */
	this.init = function(conf) {
		var contextObj;

		collection = conf.collection;
		
		if(collection === undefined)
			throw "No collection defined for maWizard!";

		if(conf.schema === undefined)
			schema = collection.simpleSchema();
		else
			schema = conf.schema;

		setCustomValidation();

		validationContext = schema.namedContext();

		if(conf.baseRoute === undefined)
			this.baseRoute = "";
		else
			this.baseRoute = conf.baseRoute;

		// if no id is specified I am adding a new object
		if(conf.id === undefined)
			contextObj = buildObjectFromSchema();
		else
			contextObj = collection.findOne(conf.id);

		this.setDataContext(contextObj);

		// there's no way to unbind events attached to templates via Meteor APIs,
		// so I keep in memory which templates I have already initialized in order
		// not to add handlers more than once
		if(conf.template && (initializedTemplates.indexOf(conf.template) === -1)) {
			this.setStandardEventHandlers(conf.template);
			initializedTemplates.push(conf.template);
		}
	};

	/**
	 * Sets standard events handlers for standard components (those with data-ma-wizard-* attributes).
	 * The events are managed by Meteor.
	 * @param  {Object} templ - Template containing the standard components
	 */
	this.setStandardEventHandlers = function(templ) {
		var backToBase = function(evt, templ) {
			var goBack = function(result) {
				if(result) {
					Router.go(maWizard.baseRoute);
					maWizard.discard();
				}
			};

			if(maWizard.hasChanged()) {
				bootbox.confirm("Unsaved updates will be discarded. Do you really want to go back?", goBack);
			}
			else goBack(true);
		};

		Template[templ].events({
			'change [data-ma-wizard-control]': function(evt, templ) {
				maWizard.saveHTMLElement(evt.currentTarget);
			},
			'click [data-ma-wizard-save]': function(evt, templ) {
				if(maWizard.saveToDatabase()) {
					Router.go(maWizard.baseRoute);
					maWizard.discard();
				}
				else {
					var onSaveFailure = maWizard.getOnSaveFailure();

					if(onSaveFailure === undefined || (typeof onSaveFailure !== "function")) {
						bootbox.alert("Cannot save to database! Check inserted data");
					}
					else onSaveFailure();
				}
			},
			'click [data-ma-wizard-cancel], click [data-ma-wizard-backToList]': backToBase,
			'click [data-ma-wizard-create]': function(evt, templ) {
				if(maWizard.create())
					Router.go(maWizard.baseRoute + "/" + maWizard.getDataContext()._id);
			},
			'click [data-ma-wizard-delete]': function(evt,templ) {
				if(maWizard.removeFromDatabase())
					Router.go(maWizard.baseRoute);
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

	this.getOnSaveFailure = function() {
		onSaveFailureDep.depend();
		return onSaveFailure;
	};
}


/**
 * Data structure used by various methods of maWizard. It simply stores
 * key/value pairs providing getters for both field name and value.
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

	if(current)
		return current[field];
	else
		return "";
});

// to use for String only, not for Number
UI.registerHelper('maWizardMaxLength', function(field) {
	var schema = maWizard.getSchemaObj();

	// if the field is of the type mainField.N.field we
	// must replace the number N with $
	var normField = field.replace(/\.\d\./, ".$.");

	if(schema && schema[normField]['max'])
		return schema[normField]['max'];
	
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
	if(msg === "")
		return "";
	else
		return " - " + msg;
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
	return getSimpleSchemaAllowedValues(field);
});
/*****************************************************************************************/

/**
 * Given a field, an array of the allowed values for that field is returned in the form of
 * objects with label/value keys. Such values are taken from the maAllowedValues() function 
 * defined in the schema definition. If the maAllowedValues function is not defined, values are
 * taken from the allowedValues field and in this case the label is equal to the value.
 * If allowedValues is also missing, an empty array is returned.
 * This function is used by the templates providing the select and multiselect components.
 * @param  {String} field - Name of the field of interest
 */
function getSimpleSchemaAllowedValues(field) {
	var maAllowedValues = maWizard.getSchemaObj(field).maAllowedValues;
	var allowedValues = maWizard.getSchemaObj(field).allowedValues;

	if(maAllowedValues) {
		// maAllowedValues() requires a function that gets a field name
		// and returns its value as parameter
		var getFieldValue = function(field) {
			return maWizard.getDataContext()[field];
		};

		return maAllowedValues(getFieldValue);
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
}

maWizard = new maWizardConstructor();
