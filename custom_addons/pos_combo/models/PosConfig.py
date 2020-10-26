# -*- coding: utf-8 -*-
# License: OPL-1
from odoo import api, fields, models, _

class PosConfig(models.Model):
    _inherit = "pos.config"

    dynamic_combo = fields.Boolean(
        'Dynamic Combo',
        help='One Order Line can add many combo items,\n'
             'Combo items is product have checked Combo Item field \n'
             'When Combo Item add, price extra will included to Order Line selected \n'
             'If you active this future, please go to Products and check to Combo Item field \n'
             'And set Combo Price, POS Combo Category both for product combo item')
