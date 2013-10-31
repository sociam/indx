define([], function() {
	var u = WebBox.utils;
	return {
		SaveWatcher: Backbone.Model.extend({
			initialize:function() {
				this.counts = { all: 0 };
			},
			_updateCounts: function(m) {
				if (m.attributes.type) {
					var stype = m.attributes.type.toString();
					this.counts[stype] = this.counts[stype] ? this.counts[stype]+1 : 1;
				}
				this.counts.all = this.counts.all+1;
				this.trigger('update', this.counts);
				console.log('counts >> ', this.counts);
			},
			_updateDisplay:function(m) {
				if (this._to) {
					clearTimeout(this._to);
					delete this._to;
					$('#last-modified').show();
				}
				var label = (m.get('type') ? "(" + m.get('type') + ") " : '') + (m.get('name') || m.get('message') || m.id);
				$('#last-modified').html(label);
				$('.mod-container').addClass('expanded');
				this._to = setTimeout(function() {
					$('.mod-container').removeClass('expanded'); $('#last-modified').fadeOut('slow');
				}, 2000);
				this._updateCounter();
			},
			_updateCounter:function() {
				$('#counter').html(this.counts.all || '');
			},
			reset:function() {
				this.counts = { all: 0 } ;
				this._updateCounter();
			},
			register: function(m) {
				var this_ = this;
				m.on('change', function() { this_._updateDisplay(m); this_._updateCounts(m); });				
			}
		})
	};
});
