from odoo import api, models, fields

class PosCategory(models.Model):
    _inherit = "pos.category"

    is_category_combo = fields.Boolean(
        'Is Combo Category',
        help='If it checked, \n'
             'When Pop-Up combo items show on POS Screen\n'
             'Pop-Up Only show POS Categories have Is Combo Category checked'
    )