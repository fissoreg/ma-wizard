# Change log

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