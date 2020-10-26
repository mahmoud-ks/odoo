# -*- coding: utf-8 -*-
# License: OPL-1
{
    'name': "POS Combo Dynamic",
    'version': '1.0.0.3',
    'category': 'Point of Sale',
    'author': 'TL Technology',
    'sequence': 0,
    'summary': 'POS Combo Dynamic',
    'description': 'POS Combo Dynamic \n'
                   'Allow define categories combo \n'
                   'Allow combine all products become combo items \n'
                   'Easy import and config product normal become to combo item',
    'depends': ['pos_restaurant'],
    'data': [
        'security/ir.model.access.csv',
        'template/template.xml',
        'views/PosConfig.xml',
        'views/PosCategory.xml',
        'views/Product.xml',
        'views/PosOrder.xml',
    ],
    'qweb': [
        'static/src/xml/*.xml'
    ],
    'price': '100',
    'website': 'http://posodoo.com',
    'application': True,
    'images': ['static/description/icon.png'],
    'support': 'thanhchatvn@gmail.com',
    "currency": 'EUR',
    "license": "OPL-1",
}
