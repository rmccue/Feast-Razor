(function ($) {
	String.prototype.lpad = function (padding, length) {
		var string = this;
		while (string.length < length) {
			string = padding + string;
		}

		return string;
	};
	String.prototype.rpad = function (padding, length) {
		var string = this;
		while (string.length < length) {
			string += padding;
		}

		return string;
	};

	Date.prototype.toHumanString = function () {
		var string = this.getFullYear();
		string += '-' + (this.getMonth() + 1).toString().lpad("0", 2);
		string += '-' + (this.getDate() + 1).toString().lpad("0", 2);
		string += ' ' + this.getHours().toString().lpad("0", 2);
		string += ':' + this.getMinutes().toString().lpad("0", 2);
		string += ':' + this.getSeconds().toString().lpad("0", 2);

		return string;
	};

	/* Relative time extensions */
	/*
	 * Returns a description of this past date in relative terms.
	 * Example: '3 years ago'
	 */
	Date.prototype.toRelativeTime = function() {
		var delta       = new Date() - this;
		var units       = null;
		var conversions = {
			millisecond: 1, // ms    -> ms
			second: 1000,   // ms    -> sec
			minute: 60,     // sec   -> min
			hour:   60,     // min   -> hour
			day:    24,     // hour  -> day
			month:  30,     // day   -> month (roughly)
			year:   12      // month -> year
		};

		for (var key in conversions) {
			if(delta < conversions[key]) {
				break;
			} else {
				units = key; // keeps track of the selected key over the iteration
				delta = delta / conversions[key];
			}
		}

		if (delta < 0) {
			return this.toHumanString();
		}

		// pluralize a unit when the difference is greater than 1.
		delta = Math.floor(delta);
		if(delta !== 1) { units += "s"; }
		return [delta, units, "ago"].join(" ");
	};

	var Razor = window.Razor = {};

	Razor.dateToHuman = function (timestamp) {
		var date = new Date(timestamp * 1000);
		return date.toHumanString();
	};
	Razor.dateToRelative = function (timestamp) {
		var date = new Date(timestamp * 1000);
		return date.toRelativeTime();
	};
	Razor.maybeScroll = function (elem, parent) {
		elem = $(elem);
		parent = $(parent);

		var pos = elem.position().top;
		var parentHeight = parent.innerHeight();
		var height = elem.outerHeight();
		if (pos < 0) {
			Razor.scrollToTop(elem, parent);
			return true;
		}
		else if ((pos + height) > parentHeight) {
			Razor.scrollToBottom(elem, parent);
			return true;
		}
		return false;
	};
	Razor.scrollToTop = function (elem, parent) {
		pos = $(parent).scrollTop() + $(elem).position().top;
		$(parent).stop(true).animate({scrollTop: pos}, 200);
	};
	Razor.scrollToBottom = function (elem, parent) {
		var pos = $(elem).position().top;
		var parentHeight = $(parent).innerHeight();
		var height = $(elem).outerHeight();
		pos = $(parent).scrollTop() + (pos - parentHeight) + height;
		$(parent).stop(true).animate({scrollTop: pos}, 200);
	};

	/* Hotkeys */
	/* From GitHub's jquery.hotkeys.js */
	Razor.hotkeys = function (c) {
		for (key in c)
			Razor.hotkey(key, c[key]);
		return this
	};
	Razor.hotkey = function (c, d) {
		c = Razor.hotkeys.special[c] == null ? c.charCodeAt(0) : Razor.hotkeys.special[c];
		Razor.hotkeys.cache[c] = d;
		return this
	};
	Razor.hotkeys.cache = {};
	Razor.hotkeys.special = {
		enter: 45,
		space: 64,
		"?": 191,
		"/": 223,
		"\\": 252,
		"`": 224
	};
	if ($.browser.mozilla && navigator.userAgent.indexOf('Macintosh') != -1)
		Razor.hotkeys.special["?"] = 0;

	// Based on wp.media.template, but without loading the media models.
	// See http://core.trac.wordpress.org/ticket/23263
	Razor.template = _.memoize(function ( id ) {
		var compiled,
			options = {
				evaluate:    /<#([\s\S]+?)#>/g,
				interpolate: /\{\{\{([\s\S]+?)\}\}\}/g,
				escape:      /\{\{([^\}]+?)\}\}(?!\})/g,
				variable:    'data'
			};

		return function ( data ) {
			compiled = compiled || _.template( $( '#tmpl-' + id ).html(), null, options );
			return compiled( data );
		};
	});

	var Feed = Backbone.Model.extend({
		defaults: function () {
			return {
				title: "Unknown Feed",
				url: "http://example.com/",
				icon: '',
			}
		},

		initialize: function () {
			// no-op
		},
	});

	var Item = Backbone.Model.extend({
		defaults: function () {
			return {
				title: "Unknown Item",
				content: "Unknown content",
				timestamp: 0,
				author: null,
				read: false,
				feed_id: 0,
			}
		},

		initialize: function () {
			// no-op
			this.listenTo(this, 'show-full', this.markRead);
		},

		markRead: function () {
			if ( ! this.get('read') )
				this.save({read: true});
		},

		markUnread: function () {
			if ( this.get('read') )
				this.save({read: false});
		},

		feed: function () {
			return Razor.Feeds.get(this.get('feed_id'));
		}
	})

	var FeedList = Backbone.Collection.extend({
		model: Feed,
		url: function () { return Razor.baseURL + '/feeds' },

		comparator: function (todo) {
			return todo.get('title')
		},

		parse: function (data) {
			return _.values(data);
		}
	});
	var ItemList = Backbone.Collection.extend({
		model: Item,
		feed_id: 0,

		url: function () {
			if (this.feed_id)
				return Razor.baseURL + '/feeds/' + this.feed_id + '/items';

			return Razor.baseURL + '/items';
		},

		initialize: function (options) {
			var options = options || {};
			this.feed_id = options.feed_id || 0;
		},

		read: function () {
			return this.filter(function (item) {
				return item.get('read');
			});
		},

		unread: function () {
			return this.without.apply(this, this.read());
		},

		comparator: function (todo) {
			return -todo.get('timestamp')
		},

		parse: function (data) {
			return _.values(data);
		},
	});

	Razor.Feeds = new FeedList;
	Razor.Items = new ItemList;

	var SidebarRow = Backbone.View.extend({
		tagName: "li",

		template: Razor.template('sidebar-item'),

		data: null,
		filter: null,

		events: {
			"click": "select"
		},

		initialize: function (options) {
			this.data = {
				title: "",
				icon: false,
				genericon: false,
				url: '',
			};
			if ( this.data.title === '' && options.title )
				this.data.title = options.title;

			if ( options.icon )
				this.data.icon = options.icon;

			if ( options.genericon )
				this.data.genericon = options.genericon;

			this.filter = options.filter;
			this.listenTo(Razor.Feeds, 'select', this.renderSelected);

			if (this.model) {
				this.listenTo(this.model, 'change', this.render);
			}
		},

		select: function () {
			Razor.App.sidebar.select(this.filter);
			return false;
		},

		render: function () {
			this.$el.html(this.template(this.data));
			this.renderSelected();
			return this;
		},

		renderSelected: function () {
			if (Razor.App) {
				// Note: isEqual is used here to ensure the values are checked
				// rather than the direct objects
				this.$el.toggleClass('selected', _.isEqual(this.filter, Razor.App.sidebar.selected));
			}
		},
	});

	var SidebarFeedRow = SidebarRow.extend({
		initialize: function (options) {
			var options = {
				title: this.model.get('title'),
				filter: {
					feed_id: this.model.id.toString(),
				}
			};
			SidebarRow.prototype.initialize.apply(this, [options]);
			this.data = this.model.attributes;
		}
	});

	var SidebarGroup = Backbone.View.extend({
		tagname: "ul",
		subviews: [],

		initialize: function () {
			//
		},

		addRow: function (options) {
			var view = new SidebarRow(options);
			this.$el.append(view.render().el);
			this.subviews.push(view);
		},

		reset: function () {
			this.$el.empty();
			this.subviews = [];
			this.feeds.each(this.addRow, this);
		},

		renderSelected: function () {
			_.each(this.subviews, function (elem) {
				elem.renderSelected();
			});
		}
	});

	var SidebarMeta = SidebarGroup.extend({
		feeds: null,

		initialize: function (options) {
			var options = options || {};
			SidebarGroup.prototype.initialize.apply(this, arguments);

			this.addRow({
				title: 'Everything',
				filter: {},
				genericon: 'category'
			});
			this.addRow({
				title: 'Unread',
				filter: {unread: true},
				genericon: 'aside'
			});
		},
	});

	var SidebarFeeds = SidebarGroup.extend({
		feeds: null,

		initialize: function (options) {
			var options = options || {};
			SidebarGroup.prototype.initialize.apply(this, arguments);

			if (options.feeds) {
				this.feeds = options.feeds;
				this.listenTo(options.feeds, 'add', this.addRow);
				this.listenTo(options.feeds, 'reset', this.reset);

				this.reset();
			}
		},

		addRow: function (feed) {
			var view = new SidebarFeedRow({model: feed});
			this.$el.append(view.render().el);
			this.subviews.push(view);
		},
	});

	var FooterItem = Backbone.View.extend({
		tagName: "li",

		template: Razor.template('footer-item'),
		data: null,

		events: {
			'click': 'click',
		},

		initialize: function (options) {
			this.data = options;
		},

		click: function (event) {
			if (this.data.callback)
				this.data.callback.apply(event, arguments);
		},

		render: function () {
			this.$el.html(this.template(this.data));
			return this;
		},
	})

	var Footer = Backbone.View.extend({
		tagName: "ul",
		className: "footer",

		subviews: [],

		addItem: function (item) {
			this.subviews.push(item);
		},

		render: function () {
			var footer = this;
			_.each(this.subviews, function (view) {
				footer.$el.append(view.render().el);
			});
			return this;
		}
	});

	var Sidebar = Backbone.View.extend({
		el: "#sidebar",
		subviews: [],

		selected: {},

		initialize: function () {
			this.subviews.push(new SidebarMeta({
				el: this.$('#library')
			}));

			this.subviews.push(new SidebarFeeds({
				el: this.$('#feeds-list'),
				feeds: Razor.Feeds
			}));

			this.listenTo(Razor.Items, 'reset', this.renderSelected);

			this.footer = new Footer();
		},

		render: function () {
			this.$el.append(this.footer.render().el);
		},

		renderSelected: function () {
			_.each(this.subviews, function (elem) {
				elem.renderSelected();
			});
		},

		select: function (attributes, force) {
			if (this.selected == attributes && !force)
				return;

			this.selected = attributes;

			var existing = [];
			if ( _.size(attributes) ) {
				existing = Razor.Items.where(attributes);

				if (existing.length) {
					Razor.Items.reset(existing);
				}
			}
			if ( existing.length === 0 ) {
				Razor.App.items.startLoading();
			}

			var new_items = new ItemList(attributes);

			// Exclude the feed ID, as it is part of the URL
			var data = _.omit(attributes, 'feed_id');

			new_items.fetch({
				data: data,
				success: function (collection, response, options) {
					//if (existing) {
					//	Razor.Items.update(collection.models);
					//}
					//else {
						Razor.Items.reset(collection.models);
					//}
				},
				error: function (collection, xhr, options) {
					Razor.App.items.stopLoading();
				}
			});
		}
	});

	var ItemRow = Backbone.View.extend({
		tagName: "li",

		template: Razor.template('list-item'),

		events: {
			"click": "select"
		},

		initialize: function () {
			this.listenTo(this.model, 'change', this.render);
			this.listenTo(Razor.Items, 'show-full', this.renderSelected);
			//this.listenTo(this.model, 'destroy', this.remove);
		},

		render: function () {
			var data = this.model.attributes;
			data.feed = Razor.Feeds.get(this.model.get('feed_id')).attributes;
			this.$el.html(this.template(data));
			this.$el.toggleClass('read', data.read);
			this.renderSelected();
			return this;
		},

		renderSelected: function () {
			if (Razor.App && Razor.App.viewer) {
				var selected = (this.model.id == Razor.App.viewer.model.id);
				this.$el.toggleClass('selected', selected);

				if (selected)
					this.trigger('select');
			}
		},

		select: function () {
			Razor.App.viewer = new ItemViewer({model: this.model});
			this.model.trigger('show-full');
			return false;
		}
	});

	var ItemListView = Backbone.View.extend({
		el: "#items-list-container",

		initialize: function () {
			this.listenTo(Razor.Items, 'add', this.addItem);
			this.listenTo(Razor.Items, 'reset', this.resetItems);
			this.listenTo(Razor.Items, 'all', this.render);

			this.footer = new Footer();

			this.footer.addItem(
				new FooterItem({
					name: 'Refresh',
					callback: function () {
						Razor.App.sidebar.select(Razor.App.sidebar.selected, true);
						this.preventDefault();
					},
				})
			);

			this.resetItems();
		},

		addItem: function (item) {
			var view = new ItemRow({model: item});
			this.listenTo(view, 'select', function () {
				this.maybeScroll(view);
			});
			this.$('ol').append(view.render().el);
		},

		resetItems: function () {
			this.$('ol').empty();
			Razor.Items.each(this.addItem, this);
			this.stopLoading();
		},

		selectPrevious: function () {
			var index;
			
			if (Razor.App.viewer) {
				index = Razor.Items.indexOf(Razor.Items.get(Razor.App.viewer.model.id));
				index--;
			}

			if (!index || index < 0) {
				index = 0;
			}

			var item = Razor.Items.at(index);
			if (!item)
				return;

			Razor.App.viewer = new ItemViewer({model: item});
			item.trigger('show-full');
		},

		selectNext: function () {
			var index;
			
			if (Razor.App.viewer) {
				index = Razor.Items.indexOf(Razor.Items.get(Razor.App.viewer.model.id));
				index++;
			}

			if (!index) {
				index = 0;
			}

			var item = Razor.Items.at(index);
			if (!item)
				return;

			Razor.App.viewer = new ItemViewer({model: item});
			item.trigger('show-full');
		},

		render: function () {
			this.stopLoading();
			this.$el.append(this.footer.render().el);
		},

		startLoading: function () {
			this.$('ol').addClass('loading');
		},

		stopLoading: function () {
			this.$('ol').removeClass('loading');
		},

		maybeScroll: function (item) {
			return Razor.maybeScroll(item.$el, this.$el);
		}
	});

	var ItemViewer = Backbone.View.extend({
		el: "#item",

		template: Razor.template('item-viewer'),

		initialize: function () {
			this.listenTo(this.model, 'change', this.render);
		},

		render: function () {
			var data = this.model.attributes;
			data.feed = Razor.Feeds.get(this.model.get('feed_id')).attributes;
			this.$el.html(this.template(data));
			return this;
		}
	})

	var AppView = Backbone.View.extend({
		el: $("body"),

		initialize: function () {
			this.sidebar = new Sidebar;
			this.items = new ItemListView;
			this.viewer = null;

			this.listenTo(Razor.Items, 'show-full', this.renderViewer);
			this.sidebar.renderSelected();

			Razor.hotkeys({
				// "?": RazorUI.showHelp,
				"k": this.items.selectPrevious,
				"j": this.items.selectNext,
				// "v": RazorUI.openCurrent,
				// "r": RazorUI.reloadItems,
				// "h": RazorUI.showHelp
			});
		},

		setup: function () {
			this.sidebar.render();
			this.sidebar.renderSelected();

			this.items.render();
		},

		renderViewer: function () {
			this.viewer.render();
		}
	});

	$(document).ready(function () {
		$(document).bind("keydown.hotkey", function (c) {
			if (!$(c.target).is(":input")) {
				if (c.ctrlKey || c.altKey || c.metaKey) return true;
				c = c.shiftKey ? c.keyCode : c.keyCode + 32;
				if (c = Razor.hotkeys.cache[c]) {
					$.isFunction(c) ? c.call(this) : (window.location = c);
					return false
				}
			}
		});

		Razor.App = new AppView;
		Razor.App.setup();
	});
})(jQuery);