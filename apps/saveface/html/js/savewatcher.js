define([], function() {
	var u = WebBox.utils;
	return {
		SaveWatcher: Backbone.Model.extend({
			initialize:function() {
				this.counts = { all: 0 };
			},
			_update_counts: function(m) {
				if (m.attributes.type) {
					var stype = m.attributes.type.toString();
					this.counts[stype] = this.counts[stype] ? this.counts[stype]+1 : 1;
				}
				this.counts.all = this.counts.all+1;
				this.trigger('update', this.counts);
				console.log('counts >> ', this.counts);
			},
			_update_display:function(m) {
				if (this._to) {
					clearTimeout(this._to);
					delete this._to;
					$('#last_modified').show();
				}
				var label = (m.get('type') ? "(" + m.get('type') + ") " : '') + (m.get('name') || m.get('message') || m.id);
				$('#last_modified').html(label);
				$('.mod_container').addClass('expanded');
				this._to = setTimeout(function() {
					$('.mod_container').removeClass('expanded'); $('#last_modified').fadeOut('slow');
				}, 2000);
				this._update_counter();
			},
			_update_counter:function() {
				$('#counter').html(this.counts.all || '');
			},
			reset:function() {
				this.counts = { all: 0 } ;
				this._update_counter();
			},
			register: function(m) {
				var this_ = this;
				m.on('change', function() { this_._update_display(m); this_._update_counts(m); });				
			}
		})
	};
});
