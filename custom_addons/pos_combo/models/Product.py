from odoo import api, fields, models

class Product(models.Model):
    _inherit = "product.template"

    is_combo_item = fields.Boolean(
        'Dynamic Combo Item',
        help='Allow this product become combo item of another Product'
    )
    combo_item_ids = fields.One2many(
        'product.combo',
        'product_tmpl_id',
        string='Fix Product',
        help='This Product Items fixed of Combo'
    )
    combo_price = fields.Float(
        'Combo Price',
        help='This price will include to base Product Combo'
    )
    combo_total_price = fields.Float(
        'Combo Total Price',
        compute='_get_total_combo_price',
        help='Combo Total Price = Product Sale Price + each item combo price x quantity of item'
    )
    is_combo = fields.Boolean(
        'Is Bundle Combo',
        compute='_get_total_combo_price'
    )

    def _get_total_combo_price(self):
        for p in self:
            p.combo_total_price = p.list_price
            p.is_combo = False
            if p.combo_item_ids:
                for combo_item in p.combo_item_ids:
                    p.combo_total_price += combo_item.quantity * combo_item.product_id.combo_price
                    p.is_combo = True

class ProductCombo(models.Model):
    _name = "product.combo"

    product_tmpl_id = fields.Many2one('product.template', "Product Template", required=1)
    product_id = fields.Many2one(
        'product.product',
        string='Product',
        domain=[('is_combo_item', '=', True)],
        required=1
    )
    quantity = fields.Float('Quantity', required=1)