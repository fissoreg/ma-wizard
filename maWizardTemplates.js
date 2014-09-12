Template.maWizardMultiselect.rendered = function() {
	var ms = $('.multiselect');

	this.autorun(function() {
		maWizard.getDataContext();

		// here we use a timeout to be sure that all the helpers
		// that react to the data context changes are executed before
		// rebuilding the multiselect, in order to be sure that the
		// HTML code has already been updated
		setTimeout(function() {
			ms.multiselect('rebuild');
		}, 0);
	});
};
Template.maWizardCheckbox.isChecked = function(field) {
	var current = maWizard.getDataContext();
	if(current && current[field])
		return 'checked';
	else
		return '';
};