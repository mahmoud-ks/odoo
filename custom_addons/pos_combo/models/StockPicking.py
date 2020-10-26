from odoo import fields, api, models

class StockPicking(models.Model):
    _inherit = "stock.picking"

    is_picking_combo = fields.Boolean('Is Picking Combo')
    pos_order_id = fields.Many2one('pos.order', 'POS order')