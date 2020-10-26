from odoo import models, fields, api
import logging

_logger = logging.getLogger(__name__)

class PosOrder(models.Model):
    _inherit = "pos.order"

    picking_ids = fields.One2many('stock.picking', 'pos_order_id', 'Delivery Orders')

    @api.model
    def create(self, vals):
        product_combo_items_dict = {}
        for line in vals.get('lines', []):
            line = line[2]
            selected_combo_items = line.get('selected_combo_items', None)
            if selected_combo_items:
                for product_id, quantity in selected_combo_items.items():
                    if not product_combo_items_dict.get(product_id, False):
                        product_combo_items_dict[int(product_id)] = quantity
                    else:
                        product_combo_items_dict[int(product_id)] += quantity
                del line['selected_combo_items']
        order = super(PosOrder, self).create(vals)
        if product_combo_items_dict:
            order.create_picking_combo_items(product_combo_items_dict)
        return order

    def create_picking_combo_items(self, combo_item_dict):
        if combo_item_dict:
            _logger.info('Begin create_picking_combo()')
            _logger.info(combo_item_dict)
            warehouse_obj = self.env['stock.warehouse']
            move_object = self.env['stock.move']
            moves = move_object
            picking_obj = self.env['stock.picking']
            picking_type = self.picking_type_id
            location_id = picking_type.default_location_src_id.id
            if self.partner_id:
                destination_id = self.partner_id.property_stock_customer.id
            else:
                if (not picking_type) or (not picking_type.default_location_dest_id):
                    customerloc, supplierloc = warehouse_obj._get_partner_locations()
                    destination_id = customerloc.id
                else:
                    destination_id = picking_type.default_location_dest_id.id
            picking_vals = {
                'is_picking_combo': True,
                'user_id': False,
                'origin': self.name,
                'partner_id': self.partner_id.id if self.partner_id else None,
                'date_done': self.date_order,
                'picking_type_id': picking_type.id,
                'company_id': self.company_id.id,
                'move_type': 'direct',
                'note': self.note or "",
                'location_id': location_id,
                'location_dest_id': destination_id,
                'pos_order_id': self.id,
            }
            picking_combo = picking_obj.create(picking_vals)
            for product_id, quantity in combo_item_dict.items():
                product = self.env['product.product'].browse(product_id)
                vals = {
                    'name': self.name,
                    'product_uom': product.uom_id.id,
                    'picking_id': picking_combo.id,
                    'picking_type_id': picking_type.id,
                    'product_id': product_id,
                    'product_uom_qty': quantity,
                    'state': 'draft',
                    'location_id': location_id,
                    'location_dest_id': destination_id,
                }
                move = move_object.create(vals)
                moves |= move
                _logger.info(vals)
            picking_combo.action_assign()
            picking_combo.action_done()
        return True

class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    def _order_line_fields(self, line, session_id=None):
        values = super(PosOrderLine, self)._order_line_fields(line, session_id)
        if line[2].get('selected_combo_items', []):
            values[2].update({'selected_combo_items': line[2].get('selected_combo_items', [])})
        return values