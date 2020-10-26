"use strict";
odoo.define('pos_combo', function (require) {
    var screens = require('point_of_sale.screens');
    var models = require('point_of_sale.models');
    var gui = require('point_of_sale.gui');
    var core = require('web.core');
    var qweb = core.qweb;
    var _t = core._t;
    var PopupWidget = require('point_of_sale.popups');

    models.load_models([
        {
            model: 'product.combo',
            fields: ['product_id', 'quantity', 'product_tmpl_id'],
            condition: function (self) {
                return self.config.dynamic_combo;
            },
            loaded: function (self, combo_items) {
                self.combo_items_by_product_tmpl_id = {};
                for (var i = 0; i < combo_items.length; i++) {
                    var item = combo_items[i];
                    var product_id = item.product_tmpl_id[0];
                    if (!self.combo_items_by_product_tmpl_id[product_id]) {
                        self.combo_items_by_product_tmpl_id[product_id] = [item]
                    } else {
                        self.combo_items_by_product_tmpl_id[product_id].push(item)
                    }
                }
            }
        },
    ], {
        after: 'product.product'
    });

    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        generate_wrapped_name: function (name) {
            var MAX_LENGTH = 24; // 40 * line ratio of .6
            var wrapped = [];
            var current_line = "";

            while (name.length > 0) {
                var space_index = name.indexOf(" ");

                if (space_index === -1) {
                    space_index = name.length;
                }

                if (current_line.length + space_index > MAX_LENGTH) {
                    if (current_line.length) {
                        wrapped.push(current_line);
                    }
                    current_line = "";
                }

                current_line += name.slice(0, space_index + 1);
                name = name.slice(space_index + 1);
            }

            if (current_line.length) {
                wrapped.push(current_line);
            }

            return wrapped;
        },
        get_model: function (_name) {
            var _index = this.models.map(function (e) {
                return e.model;
            }).indexOf(_name);
            if (_index > -1) {
                return this.models[_index];
            }
            return false;
        },
        initialize: function (session, attributes) {
            var pos_category_model = this.get_model('pos.category');
            if (pos_category_model) {
                pos_category_model.fields = pos_category_model.fields.concat(['is_category_combo']);
                var _super_loaded_pos_category_model = pos_category_model.loaded;
                pos_category_model.loaded = function (self, categories) {
                    if (!self.pos_categories) {
                        self.pos_categories = categories;
                        self.pos_category_by_id = {};
                    } else {
                        self.pos_categories = self.pos_categories.concat(categories);
                    }
                    for (var i = 0; i < categories.length; i++) {
                        var category = categories[i];
                        self.pos_category_by_id[category.id] = category;
                    }
                    _super_loaded_pos_category_model(self, categories);
                };
            }
            var product_model = this.get_model('product.product');
            if (product_model) {
                product_model.fields = product_model.fields.concat(['is_combo_item', 'combo_price', 'is_combo', 'combo_total_price']);
            }
            _super_PosModel.initialize.call(this, session, attributes);
        },
    });
    var button_dynamic_combo = screens.ActionButtonWidget.extend({ // combo button
        template: 'button_dynamic_combo',
        button_click: function () {
            var self = this;
            var order = self.pos.get_order();
            var selected_line = order.get_selected_orderline();
            if (!selected_line) {
                return this.pos.gui.show_popup('confirm', {
                    title: _t('Warning'),
                    body: _t('No Line Selected, please selected one line inside order cart before')
                })
            }
            if (selected_line && selected_line.quantity == 0) {
                return this.pos.gui.show_popup('confirm', {
                    title: _t('Warning'),
                    body: _t('Quantity of Line is 0, please set quantity bigger than 0 before add combo items')
                })
            }
            if (!selected_line.line_included_combo_items() && selected_line && selected_line.quantity > 0) {
                order.add_fixed_combo_items();
            }
            var pos_categories_combo = _.filter(this.pos.pos_categories, function (categ) {
                return categ.is_category_combo
            });
            if (pos_categories_combo.length == 0) {
                return this.pos.gui.show_popup('confirm', {
                    title: _t('Warning'),
                    body: _t('Your POS Categories have not any Category Combo')
                })
            }
            this.pos.gui.show_popup('popup_dynamic_combo', {
                title: _t('Please select one Category and Add Combo Items'),
                body: _t('Please select combo items and add to line selected'),
                selected_combo_items: selected_line.selected_combo_items,
                confirm: function (selected_combo_items) {
                    selected_line.add_combo_items(selected_combo_items);
                }
            })
        }
    });

    screens.define_action_button({
        'name': 'button_dynamic_combo',
        'widget': button_dynamic_combo,
        'condition': function () {
            return this.pos.config.dynamic_combo;
        }
    });
    var _super_Order = models.Order.prototype;
    models.Order = models.Order.extend({
        add_product: function (product, options) {
            var res = _super_Order.add_product.apply(this, arguments);
            this.add_fixed_combo_items();
            return res;
        },
        add_fixed_combo_items: function () {
            if (!this.pos.config.dynamic_combo) {
                return;
            }
            var selected_orderline = this.get_selected_orderline();
            var product = selected_orderline.product;
            var combo_items = this.pos.combo_items_by_product_tmpl_id[product.product_tmpl_id];
            if (combo_items) {
                var selected_combo_items = {};
                for (var i = 0; i < combo_items.length; i++) {
                    var item = combo_items[i];
                    selected_combo_items[item.product_id[0]] = item.quantity
                }
                selected_orderline.add_combo_items(selected_combo_items)
            }
        }
    });
    var _super_Orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function (attributes, options) {
            var res = _super_Orderline.initialize.apply(this, arguments);
            if (!options.json) {
                this.selected_combo_items = {};
            }
            return res;
        },
        init_from_JSON: function (json) {
            var res = _super_Orderline.init_from_JSON.apply(this, arguments);
            if (json.selected_combo_items) {
                this.selected_combo_items = json.selected_combo_items;
            }
            if (json.price_extra) {
                this.price_extra = json.price_extra;
            }
            return res;
        },
        export_as_JSON: function () {
            var json = _super_Orderline.export_as_JSON.apply(this, arguments);
            if (this.selected_combo_items) {
                json.selected_combo_items = this.selected_combo_items;
            }
            if (this.price_extra) {
                json.price_extra = this.price_extra;
            }
            return json;
        },
        export_for_printing: function () {
            var receipt_line = _super_Orderline.export_for_printing.apply(this, arguments);
            if (this.selected_combo_items) {
                receipt_line['selected_combo_items'] = this.selected_combo_items;
            }
            if (this.price_extra) {
                receipt_line['price_extra'] = this.price_extra;
            }
            return receipt_line
        },
        line_included_combo_items: function() {
            if (!this.selected_combo_items) {
                return false;
            }
            if (Object.keys(this.selected_combo_items).length == 0 || !this.selected_combo_items) {
                return false
            } else {
                return true
            }
        },
        get_unit_price: function () {
            var unit_price = _super_Orderline.get_unit_price.apply(this, arguments);
            if (this.price_extra) {
                unit_price += this.price_extra;
            }
            return unit_price;
        },
        add_combo_items: function (selected_combo_items) {
            var price_extra = 0;
            for (var product_id in selected_combo_items) {
                var product = this.pos.db.product_by_id[parseInt(product_id)];
                if (!product) {
                    continue
                }
                price_extra += product['combo_price'] * selected_combo_items[product_id];
            }
            this.selected_combo_items = selected_combo_items;
            this.price_extra = price_extra;
            this.trigger('change', this);
        },
        can_be_merged_with: function (orderline) {
            var merge = _super_Orderline.can_be_merged_with.apply(this, arguments);
            var line_included_combo_items = this.line_included_combo_items();
            if (line_included_combo_items) {
                return false;
            } else {
                return merge
            }
        },
        set_quantity: function (quantity, keep_price) {
            _super_Orderline.set_quantity.apply(this, arguments);
            if (this.line_included_combo_items() && quantity != 'remove') {
                for (var product_id in this.selected_combo_items) {
                    var combo_item_qty = this.selected_combo_items[product_id];
                    this.selected_combo_items[product_id] = combo_item_qty * quantity
                }
                this.add_combo_items(this.selected_combo_items)
            }
            if (quantity == '' || quantity == 0) {
                this.add_combo_items({})
            }
        }
    });

    var popup_dynamic_combo = PopupWidget.extend({ // select combo
        template: 'popup_dynamic_combo',
        get_product_image_url: function (product) {
            return window.location.origin + '/web/image?model=product.product&field=image_128&id=' + product.id;
        },
        show: function (options) {
            this.limit = 100;
            this.options = options;
            this.selected_combo_items = options.selected_combo_items || {};
            this._super(options);
            var pos_categories_combo = _.filter(this.pos.pos_categories, function (categ) {
                return categ.is_category_combo
            });
            this.$el.find('input').focus();
            this.$el.find('.table-striped-1>tbody').html(qweb.render('dynamic_categories_combo', {
                pos_categories: pos_categories_combo,
                widget: this
            }));
            this._add_event_click_line();
            this._click_category();
        },
        _click_minus_plus: function () {
            var self = this;
            this.$('.minus').click(function () {
                var product_id = parseInt($(this).parent().data('productId'));
                if (self.selected_combo_items[product_id] == undefined) {
                    self.selected_combo_items[product_id] = 0;
                } else {
                    if (self.selected_combo_items[product_id] > 0) {
                        self.selected_combo_items[product_id] -= 1
                    }
                }
                if (self.selected_combo_items[product_id] || self.selected_combo_items[product_id] == 0) {
                    $(this).parent().find('.combo-item-cart_qty').html(self.selected_combo_items[product_id])
                }
            });
            this.$('.plus').click(function () {
                var product_id = parseInt($(this).parent().data('productId'));
                if (!self.selected_combo_items[product_id]) {
                    self.selected_combo_items[product_id] = 1;
                } else {
                    self.selected_combo_items[product_id] += 1
                }
                $(this).parent().find('.combo-item-cart_qty').html(self.selected_combo_items[product_id])
            });
        },
        _click_category: function () {
            var self = this;
            this.$('.popup_category_item').click(function () {
                var category_id = parseInt($(this).data('categoryId'));
                var products_by_category = self.pos.db.get_product_by_category(category_id);
                var products_is_combo_item = _.filter(products_by_category, function (product) {
                    return product.is_combo_item;
                });
                var products = [];
                for (var n = 0; n < products_is_combo_item.length; n++) {
                    var product_exist = _.find(products, function (p) {
                        return p.id == products_is_combo_item[n].id
                    });
                    if (!product_exist) {
                        products.push(products_is_combo_item[n])
                    }
                }
                if (products.length) {
                    for (var i = 0; i < products.length; i++) {
                        var product = products[i];
                        if (self.selected_combo_items[product.id]) {
                            product.quantity = self.selected_combo_items[product.id];
                        } else {
                            product.quantity = 0
                        }
                    }
                    self.$el.find('.table-striped-2>tbody').html(qweb.render('dynamic_combo_items', {
                        products: products,
                        widget: self
                    }));
                    self.category_selected_id = category_id;
                    self._click_minus_plus();
                } else {
                    self.$el.find('.table-striped-2>tbody').html(qweb.render('dynamic_combo_items_not_found', {
                        widget: self
                    }));
                }
            });
        },
        _add_event_click_line: function () {
            var self = this;
            this.$('.add_quantity').click(function () {
                var selected_id = parseInt($(this).data('id'));
                var data_selected = _.find(self.sub_datas, function (sub_data) {
                    return sub_data.id == selected_id
                });
                if (data_selected) {
                    data_selected['quantity'] += 1;
                    $(this).html(data_selected['quantity'])
                }
                self.passed_input('tr[data-id="' + selected_id + '"]');
            });
            this.$('.remove_quantity').click(function () {
                var selected_id = parseInt($(this).data('id'));
                var data_selected = _.find(self.sub_datas, function (sub_data) {
                    return sub_data.id == selected_id
                });
                if (data_selected) {
                    if (data_selected['quantity'] > 0) {
                        data_selected['quantity'] -= 1;
                        $(this).parent().find('.add_quantity').html(data_selected['quantity'])
                        self.passed_input('tr[data-id="' + selected_id + '"]');
                    } else {
                        self.wrong_input('tr[data-id="' + selected_id + '"]', "(*) Quantity required bigger than or equal 0");
                    }
                }
            });
        },
        click_confirm: function () {
            if (this.options.confirm) {
                var values = {};
                for (var product_id in this.selected_combo_items) {
                    if (this.selected_combo_items[product_id] > 0) {
                        values[product_id] = this.selected_combo_items[product_id]
                    }
                }
                this.options.confirm.call(this, values);
                this.pos.gui.close_popup();
            }
        },
    });
    gui.define_popup({name: 'popup_dynamic_combo', widget: popup_dynamic_combo});

    var _super_order = models.Order.prototype;
    _super_order.computeChanges = function (categories) {
        var d = new Date();
        var hours = '' + d.getHours();
        hours = hours.length < 2 ? ('0' + hours) : hours;
        var minutes = '' + d.getMinutes();
        minutes = minutes.length < 2 ? ('0' + minutes) : minutes;
        var current_res = this.build_line_resume();
        var old_res = this.saved_resume || {};
        var json = this.export_as_JSON();
        var add = [];
        var rem = [];
        var line_hash;
        for (line_hash in current_res) {
            var curr = current_res[line_hash];
            var old = old_res[line_hash];
            var product = this.pos.db.get_product_by_id(curr.product_id);
            var pos_categ_id = product.pos_categ_id;
            if (pos_categ_id.length) {
                pos_categ_id = pos_categ_id[1]
            }
            if (typeof old === 'undefined') {
                add.push({
                    'order_uid': json.uid,
                    'id': curr.product_id,
                    'uid': curr.uid,
                    'name': product.display_name,
                    'name_wrapped': curr.product_name_wrapped,
                    'note': curr.note,
                    'qty': curr.qty,
                    'selected_combo_items': curr.selected_combo_items,
                    'category': pos_categ_id,
                    'time': hours + ':' + minutes,
                });
            } else if (old.qty < curr.qty) {
                add.push({
                    'order_uid': json.uid,
                    'id': curr.product_id,
                    'uid': curr.uid,
                    'name': product.display_name,
                    'name_wrapped': curr.product_name_wrapped,
                    'note': curr.note,
                    'qty': curr.qty - old.qty,
                    'selected_combo_items': curr.selected_combo_items,
                    'category': pos_categ_id,
                    'time': hours + ':' + minutes,
                });
            } else if (old.qty > curr.qty) {
                rem.push({
                    'order_uid': json.uid,
                    'id': curr.product_id,
                    'uid': curr.uid,
                    'name': product.display_name,
                    'name_wrapped': curr.product_name_wrapped,
                    'note': curr.note,
                    'qty': old.qty - curr.qty,
                    'selected_combo_items': curr.selected_combo_items,
                    'state': 'Cancelled',
                    'category': pos_categ_id,
                    'time': hours + ':' + minutes,
                });
            }
        }

        for (line_hash in old_res) {
            if (typeof current_res[line_hash] === 'undefined') {
                var old = old_res[line_hash];
                var product = this.pos.db.get_product_by_id(old.product_id);
                var pos_categ_id = product.pos_categ_id;
                if (pos_categ_id.length) {
                    pos_categ_id = pos_categ_id[1]
                }
                rem.push({
                    'order_uid': json.uid,
                    'id': old.product_id,
                    'uid': old.uid,
                    'name': this.pos.db.get_product_by_id(old.product_id).display_name,
                    'name_wrapped': old.product_name_wrapped,
                    'note': old.note,
                    'qty': old.qty,
                    'uom': old.uom,
                    'variants': old.variants,
                    'tags': old.tags,
                    'selected_combo_items': old.selected_combo_items,
                    'state': 'Cancelled',
                    'category': pos_categ_id,
                    'time': hours + ':' + minutes,
                });
            }
        }

        if (categories && categories.length > 0) {
            // filter the added and removed orders to only contains
            // products that belong to one of the categories supplied as a parameter

            var self = this;

            var _add = [];
            var _rem = [];

            for (var i = 0; i < add.length; i++) {
                if (self.pos.db.is_product_in_category(categories, add[i].id)) {
                    _add.push(add[i]);
                }
            }
            add = _add;

            for (var i = 0; i < rem.length; i++) {
                if (self.pos.db.is_product_in_category(categories, rem[i].id)) {
                    _rem.push(rem[i]);
                }
            }
            rem = _rem;
        }
        return {
            'guest_number': json['guest_number'],
            'guest': json['guest'],
            'note': json['note'],
            'uid': json['uid'],
            'new': add,
            'cancelled': rem,
            'table': json.table || false,
            'floor': json.floor || false,
            'name': json.name || 'unknown order',
            'time': {
                'hours': hours,
                'minutes': minutes,
            },
        };
    };
    _super_order.build_line_resume = function () {
        var resume = {};
        var self = this;
        this.orderlines.each(function (line) {
            if (line.mp_skip) {
                return;
            }
            var line_hash = line.get_line_diff_hash();
            var qty = Number(line.get_quantity());
            var note = line.get_note();
            var product_id = line.get_product().id;
            var product = self.pos.db.get_product_by_id(product_id);
            var pos_categ_id = product.pos_categ_id;
            if (pos_categ_id.length) {
                pos_categ_id = pos_categ_id[1]
            }
            if (typeof resume[line_hash] === 'undefined') {
                resume[line_hash] = {
                    uid: line.uid,
                    qty: qty,
                    note: note,
                    product_id: product_id,
                    product_name_wrapped: line.generate_wrapped_product_name(),
                    selected_combo_items: [],
                    category: pos_categ_id,
                    state: line.state
                };
                if (line.selected_combo_items) {
                    resume[line_hash]['selected_combo_items'] = line['selected_combo_items']
                }
            } else {
                resume[line_hash].qty += qty;
            }
        });
        return resume;
    };
});
