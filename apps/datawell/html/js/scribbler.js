<div class="scribbler">
	<div class="buttons">
		<div ng-class="{ 'btn':true, 'glyphicon':true, 'glyphicon-remove': true, disabled:selected_path }" 
			 ng-click="deleteSelected()">
		</div>
		<div class="{'btn':true, 'glyphicon':true, 'glyphicon-backward':true, disabled:data.length > 0}" ng-click="deleteLast()">
		</div>
	</div>
</div>