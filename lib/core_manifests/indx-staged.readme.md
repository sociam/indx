indx.staged
- adds staging area to indx models
- always kept up-to-date from model.attributes
- clones attribute's arrays

adds model.staged, which is a Backbone.Model.

Properties/Methods:
- model.staged.attributes - where to stage changes
- model.staged.set('key', 'val' OR {'key':'val',...}), model.get('key'), model.has('key')
- model.staged.reset() - revert model.stagedAttributes to attributes
- model.staged.commit() - update attribute with staged attributes
- model.staged.save() - save staged attributes to server (equiv. to commitStaged() then save())


box.getObj('my-obj').then(function (obj) {
	indxStaging(obj); // extend obj with staging
})

- useful for angular binding:

```html
<form ng-submit="person.staged.save()">
	<input ng-model="person.staged.attributes.name[0]">
	<input type="submit">
	<input type="button" value="Cancel" ng-click="person.staged.cancel()">
</form>
```