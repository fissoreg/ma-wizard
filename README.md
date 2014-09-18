ma:wizard
=========

ma:wizard is a smart package for [Meteor](https://www.meteor.com/) which simplifies data entry procedures in your app. It provides reactive data validation and lets you manage precisely the workflow of operations, giving you total control over the UI while providing little modular components that automatically integrate the package functionalities.

ma:wizard makes use of [maSimpleSchema](https://github.com/doubleslashG/ma-simple-schema) for schemas definition and validation.

## Installation
As the package is not in the sky, you should use `mrt`. Modify your `smart.json` as follows:
````
{
  "packages": {
    "ma:simple-schema": {
    	"git": "https://github.com/doubleslashG/ma-simple-schema.git"
    },
    "ma:wizard": {
        "git": "https://github.com/doubleslashG/ma-wizard.git"
    }
  }
}
````
Then start your app with:
````bash
$ cd my_project_folder/
$ mrt
````
For Meteor >= 0.9, add the package with `meteor add`:
````bash
$ meteor add ma:wizard
````

Enjoy! :)

## Basics
Once the package is installed, the global `maWizard` object is available. This provides methods to work with the UI and to access inserted data, which are saved to the 'data context' of `maWizard`, a reactive data source which reproduces the database record but that is held in memory and can be accessed reactively by calling `maWizard.getDataContext()`.
`maWizard` should be initialized before use by calling the `init(conf)` method on it, which takes as parameter a configuration object with the following fields:

* `collection`: the MongoDB collection to work with.
* `id`: Optional. `_id` of the document to load from database, if any.
* `schema`: Optional. maSimpleSchema object related to `collection`. If not specified, `maWizard` expects to find the schema definition attached to the collection itself (through the maSimpleSchema method `attachSchema`).
* `template`: Optional. If you use the UI components provided by `maWizard`, you should specify the name of the template that is using them.
* `baseRoute`: Optional. Set a base route referred to by standard actions.

#### Create mode
If no `id` is specified in `conf`, `maWizard` is initialized in "create" mode.  This means that the data context is initialized with an object built from the schema and whose values are default. The `_id` field will be `undefined` until the `maWizard.create()` method is called.
Example:
````javascript
maWizard.init({
	collection: Country,
	template: "countryView"
}
````
Calling the `create()` method a new document is inserted into the database and the corresponding `_id` is set in the data context, thus switching to "update" mode.


#### Update mode
If an `id` is specified in `conf` or after calling `create()`, the right document is read from database and saved to the data context. You can then update the data as wanted without affecting the database. To make the final changes persistent, call `maWizard.saveToDatabase()`.

## Standard components
Standard components are handy ready-to-use templates that work out of the box with `maWizard`. As an example, consider the 'country' schema:
````javascript
CountrySchema = new maSimpleSchema({
	name: {
		type: String,
		label: "Name",
		max: 200,
		maDependencies: ["majorAirports"]
	},
	majorAirports: {
		type: [String],
		label: "Major airports"
	}
});
````
To let the user add a country just setting the name, we must initialize `maWizard` in "create" mode:
````javascript
maWizard.init({
	collection: Countries,
	schema: CountrySchema,
	template: "countryView"
});
````
Then, for the UI, we use a `maWizardTextInput`:
````HTML
<template name="countryView">
	{{> maWizardTextInput field="name" label="Country name" placeholder="Set country name..."}}
	{{> maWizardCreate}}
</template>
````
This is enough to provide the user with a text input to insert the country name (the `maWizardTextInput` template) and a button to insert the new entry into the database (the `maWizardCreate` template).
Using standard components, inserted values are automatically validated and saved to the data context on the `change` event (which fires when the user changes the value of the component and then focus is lost). If a value is invalid, an error message is shown and the component is styled with the `has-error` Bootstrap3 class.

#### maWizardTextInput
A simple text input. It accepts both characters and numbers, though the validation is coherent with the data type reported in the schema definition.

#### maWizardTextarea
A simple textarea. It accepts both characters and numbers, though the validation is coherent with the data type reported in the schema definition.

#### maWizardCheckbox
A simple checkbox to deal with boolean values. This template just accepts the `field` and `label` parameters.

#### maWizardSelect
A `<select>` element whose options are specified by the `values` parameter:
````HTML
{{> maWizardSelect field="genre" label="Genre" placeholder="Choose a genre" values=arrayOfGenres }}
````
If the `values` parameter is not specified, the options are read from the `maAllowedValues` or `allowedValues` field in the schema definition (in the reported order) by using the `maWizard.getSimpleSchemaAllowedValues(field)` method.

#### maWizardMultiselect
This component works the same as `maWizardSelect`, but lets you select more then one option. Works with schema entries whose `type` is an array (as `[String]`).

#### maWizardCreate
Button to save the current data context in the database creating a new document. If you use this in "update" mode, you could duplicate database entries. Usually, you want to conditionally display this element checking for the `_id` field in the data context (see example for `maWizardSave`).

#### maWizardSave
Button to update an existing document in the database with the values present in the data context. Usually, you want to conditionally display this element if we are in "update" mode:
````HTML
{#if getDataContextFieldHelper '_id'}}
	{{> maWizardCreate }}
{{else}}
	{{> maWizardSave }}
{{/if}}
````
If the document is saved without errors, navigates to `baseRoute` (or home "/" if no `baseRoute` has been set) via `iron:router`.

#### maWizardOk
Same behaviour as `maWizardSave`, but the button label is "Ok" and an eventual `onSaveFailure()` callback set with `maWizard.setOnSaveFailure(callback)` is ignored. If the data context is invalid, an alert is shown and navigation to `baseRoute` is aborted.

#### maWizardBack
Same behaviour as `maWizardOk`, but the button label is "Back".

#### maWizardDiscard
Discard changes to the data context and navigates to `baseRoute` (or home "/" if no `baseRoute` has been set).

#### maWizardDelete
Button to delete the current document from database. To use in "update" mode.

## Attaching standard actions to other components
If you want to define your own components for the standard Create, Save, Ok, Discard, Back and Delete actions, just add the boolean attribute `data-ma-wizard-actionName` to the chosen component, where `actionName` is one among `create`, `save`, `ok`, `discard`, `back` and `delete`.
As an example, here is the definition of the `maWizardOk` template:
````HTML
<template name="maWizardOk">
  <button class="btn btn-default" data-ma-wizard-ok>Ok</button>
</template>
````

## Custom components
If the standard components don't fit your needs, you can easily define fancy custom components that are automatically managed by `maWizard`. To let `maWizard` be aware of the existence of your custom component, just add the boolean attribute `data-ma-wizard-control` to it. Then to link the component to a certain schema field, use the attribute `data-schemafield="fieldName"`. The value stored in the data context by `maWizard` is read from the `value` attribute of the HTML component.

Sometimes you want a greater control over your custom components and you don't want `maWizard` to automatically manage them. In such a case, you can take complete control and use the `maWizard` API (see the "Custom component definition and manual management" section).

## maWizard Helpers
A set of reactive helpers to use with custom components.

#### maWizardGetFieldValue(field)
Reactively gets the value of the specified schema field.

#### maWizardFieldValidity(field)
If the field is invalid, returns `"has-error"` (this is the Bootstrap3 class attached to the standard components when the corresponding field value is invalid). Returns the empty string otherwise.
This is a reactive method that runs every time the specified field is validated by `maWizard`.

#### maWizardErrMsg(field)
If the field is invalid, returns an appropriate error message (as specified in `maSimpleSchema`). Returns the empty string otherwise.
This is a reactive method that runs every time the specified field is validated by `maWizard`.

#### maWizardAllowedValuesFromSchema(field)
Returns an array of label/value pairs read from the `maAllowedValues` or `allowedValues` field in the schema definition, with priority given to `maAllowedValues`.

## Custom component definition and manual management
As an example, here is the definition of a text input linked to a `length` field:
````HTML
<template name="myTextInput">
	<div class="form-group {{maWizardFieldValidity 'length'}}">
		<label class="control-label">Length {{maWizardErrMsg 'length'}}</label>
		<input type="text" class="form-control " data-my-component placeholder="Length..." value={{myGetFieldValue 'length'}} data-schemafield='length' autofocus
	</div>
</template>
````
The `input` element is contained in a Bootstrap3 `form-group` element, and we are using the `maWizardFieldValidity` and `maWizardErrMsg` helpers for graphic validation. The `data-ma-wizard-control` attribute has been substituted by `data-my-component`, so that `maWizard` will ignore the component and we may refer to it via the new attribute. To get the value of the field we could use the `maWizardGetFieldValue` helper or define our own helper to gain control over the displayed value (as done the code above).

Now let's say we want to display the value of the `length` field as a measure in centimeters or inches depending on our app settings. Suppose that values in the database are always expressed in centimeters, so that we should eventually perform a conversion when needed. To do that, we define our own `myGetFieldValue` helper as follows:
````javascript
Template.myTextInput.myGetFieldValue = function(field) {
	var value;	
	var rawValue = maWizard.getDataContext()[field];

	if(myOptions.isUsingCustomaryUnits())
		value = convert(value);
	else
		value = rawValue;

	return value;
};
````
So now the `length` field is correctly displayed. However, we should still manage user changes to the values, so we can define the following handler on `change` event:
````javascript
Template.myTextInput.events({
	'change [data-my-component]': function(evt, templ) {
		if(myOptions.isUsingCustomaryUnits()) {
			var fieldValuePair = maWizard.parseHTMLElement(evt.currentTarget);
			var value = convert(fieldValuePair.getValue());
			fieldValuePair.setValue(value);
			maWizard.processFieldValuePair(fieldValuePair);
		}
		else maWizard.saveHTMLElement(evt.currentTarget);
});
````
Now, the new component works as the standard components with the added functionality. Refer to the API section for documentation on the used methods.

## Router.go() and invalid data
The `Router.go()` function of `iron:router` is overridden by `maWizard` in order to prevent the user from navigating away from the current route if invalid data are present, so the user is obliged to discard changes or correct eventual mistakes before leaving the form/wizard. This makes data saved to database be always valid and up-to-date.

## API
jsDoc generated: [API](http://htmlpreview.github.io/?https://github.com/doubleslashG/ma-wizard/blob/master/DOC/global.html)
