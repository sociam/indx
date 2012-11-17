define(['js/utils','text!apps/enriches/round_template.html'], function(u,round) {
	console.log('foo');

	var assert = u.assert, deferred = u.deferred, defined = u.defined;

	var example_round = {
		text: "M & S Kings X",
		name: { begin: 0, end: 4 },
		location: { begin: 5, end: 15 },
		categories: ['groceries']
	};	
	var RoundView = Backbone.View.extend({
		template:round,
		tagClass:'round',
		events: {
			'select .select-name' : '_cb_name_input_selection',
			'select .select-location' : '_cb_location_input_sel'			
		},
		initialize:function(options) {
			assert(options.round, 'please provide a round as an argument');
		},
		_cb_location_input_sel:function(evt) {
			console.log(evt.target);
			var start = evt.target.selectionStart, end = evt.target.selectionEnd;
			var val = $(evt.target).val().substring(start,end);			
			this.$el.find('.display-selected-location').val(val);			
		},
		_cb_name_input_selection:function(evt) {
			var start = evt.target.selectionStart, end = evt.target.selectionEnd;
			var val = $(evt.target).val().substring(start,end);						
			this.$el.find('.display-selected-name').val(val);
		},		
		render:function() {
			var html = _(this.template).template(this.options.round);
			this.$el.html( html );
			var cats = this.$el.find('.categories-input');
			cats.children('.option').remove();
			$.ajax({url:'categories/cat-simple.json', type:"GET", dataType:"json"}).success(function(result) {
				result.categories.map(function(c) {
					var h = _('<option value="<%= text %>"><%= text %></option>').template({text:c});
					cats.append(h);
				});
				$(".chzn-select").chosen({no_results_text: "No results matched"});				
			}).error(function(f) {	console.log("FAIL ", f);});
			return this;
		}
	});
	var EnrichView = Backbone.View.extend({
		show_round:function(round) {
			console.log('showing round >> ', round);
			var roundview = new RoundView({round:round});
			this.roundview = roundview;
			this.$el.find('.round-holder').children().remove();
			this.$el.find('.round-holder').append(roundview.render().el);
			
			this.render();
		},
		render:function() {
			return this;
		}
	});

	var EnrichApp = Backbone.Model.extend({
		initialize:function() {
			this.view = new EnrichView({el:$('.main')[0]});
			$('body').append(this.view.render().el);
			this.view.show_round(example_round);
		},
		show:function() {
			this.view.$el.show();
		},
		hide:function() {
			this.view.$el.hide();
		}				
	});

	return {
		init:function() {
			return new EnrichApp();
		}
	};	
});
