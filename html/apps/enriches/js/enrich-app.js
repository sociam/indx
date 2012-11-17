define(['js/utils','text!apps/enriches/round_template.html'], function(u,round) {

	var assert = u.assert, deferred = u.deferred, defined = u.defined;
		
	var RoundView = Backbone.View.extend({
		template:round,
		tagClass:'round',
		events: {
			'mouseup .name-input' : '_cb_name_input_selection',
			'mouseup .location-input' : '_cb_location_input_sel'			
		},
		initialize:function() {
			assert(options.round, 'please provide a round as an argument');
		},
		_cb_location_input_sel:function() {
			console.log('location input sel > ', this.$el.find('.name-input').getSelection());
		},
		_cb_name_input_sel:function() {
			console.log('name input sel > ', this.$el.find('.name-input').getSelection());
		},		
		render:function() {
			var html = _(this.template).template(this.options.round);
			this.$el.html( html );
			return this;
		}
	});

	var EnrichView = Backbone.View.extend({
		show:function(round) {
			this.round = round;
			this.render();
		},
		render:function() {
			
			return this;
		}
	});

	var EnrichApp = Backbone.Model.extend({
		initialize:function() {
			this.view = new EnrichView();
			$('body').append(this.view.render().el);
		}
	});

	return {
		init:function() {
			return new EnrichApp();
		}
	};	
});
