# Change log

## 3.1.0
Fix #11

## 3.0.0
1. Added class `ma-wizard-modal` to specify in Bootstrap modal HTML elements
2. Updated documentation (both README.md and jsDoc)

## 2.4.1
Bugfix on delete action when inside modal

## 2.4.0
Added `isModal` boolean parameter in `init()` and `isModal()`, `getTemplateName()` public methods.
`maWizard` now knows if the template is a modal and acts accordingly. Fix #10

## 2.3.0
1. Changed Bootstrap-multiselect with Select2 for `maWizardSelect` and `maWizardMultiselect`
2. Added `Add...` options with `addRoute` parameter in `maWizardSelect` and `maWizardMultiselect`
3. Added `natestrauser:select2` dependency
4. Fix #6

## 2.2.0
Added `maWizardBtn` standard component: a save button with custom label

## 2.1.1
Error messages are now shown under standard components (bootstrap-like).
Fix #7

## 2.1.0
`ma:wizard` now hides non-visible fields (reading from `Schemas` collection) - to document in next commit

## 2.0.1
`label` and `placeholder` template parameters are now read from schema if not specified.

## 2.0.0
1. Added `maWizardOk` standard component
2. `maWizardCancel` became `maWizardDiscard` and `maWizardBackToList` became `maWizardBack`
3. `iron:router` dependency
4. Override of Router.go
5. Changed behaviour of public method `maWizard.discard()` and added `maWizard.reset()`